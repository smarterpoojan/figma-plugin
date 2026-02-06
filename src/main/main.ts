import {
  AvailableAssetsPayload,
  PluginMessage,
  SelectionPayload,
  StyleUsage,
  VariableUsage,
} from "../shared/types";

figma.showUI(__html__, { width: 420, height: 520 });

const selectionState: SelectionPayload = {
  hasSelection: false,
  variables: [],
  styles: [],
};

const availableAssets: AvailableAssetsPayload = {
  variables: [],
  styles: [],
};

const VARIABLE_PROPERTY_KEYS = [
  "fills",
  "strokes",
  "effects",
  "opacity",
  "fontSize",
  "letterSpacing",
  "lineHeight",
  "fontName",
  "textDecoration",
  "textCase",
  "cornerRadius",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "itemSpacing",
  "width",
  "height",
] as const;

type VariablePropertyKey = (typeof VARIABLE_PROPERTY_KEYS)[number];

type NodeWithBoundVariables = SceneNode & {
  boundVariables?: Record<string, string | string[] | null>;
  setBoundVariable?: (property: string, variableId: string | null) => void;
  setBoundVariableForPaint?: (
    paint: Paint,
    field: "color" | "opacity" | "gradientStops" | "imageFilter" | "imageTransform",
    variableId: string | null,
  ) => void;
};

// Breadth-first traversal to collect the selection and all nested children.
function getAllSceneNodes(rootNodes: readonly SceneNode[]): SceneNode[] {
  const collected: SceneNode[] = [];
  const queue = [...rootNodes];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;
    collected.push(node);
    if ("children" in node) {
      queue.push(...node.children);
    }
  }

  return collected;
}

// Normalize usage maps into sorted arrays for the UI.
function normalizeUsage<T extends { id: string; usageCount: number }>(
  map: Map<string, T>,
): T[] {
  return [...map.values()].sort((a, b) => b.usageCount - a.usageCount);
}

// Increment variable usage with a deduplicated map.
function incrementVariableUsage(
  usageMap: Map<string, VariableUsage>,
  variableId: string,
) {
  const variable = figma.variables.getVariableById(variableId);
  if (!variable) return;

  const existing = usageMap.get(variable.id);
  if (existing) {
    existing.usageCount += 1;
    return;
  }

  usageMap.set(variable.id, {
    id: variable.id,
    name: variable.name,
    resolvedType: variable.resolvedType,
    usageCount: 1,
  });
}

// Collect bound variables across supported node properties.
function collectVariablesFromNode(
  node: NodeWithBoundVariables,
  usageMap: Map<string, VariableUsage>,
) {
  const boundVariables = node.boundVariables;
  if (!boundVariables) return;

  VARIABLE_PROPERTY_KEYS.forEach((key) => {
    const value = boundVariables[key as VariablePropertyKey];
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach((variableId) => incrementVariableUsage(usageMap, variableId));
    } else if (typeof value === "string") {
      incrementVariableUsage(usageMap, value);
    }
  });
}

// Increment style usage with a deduplicated map.
function incrementStyleUsage(
  usageMap: Map<string, StyleUsage>,
  styleId: string,
) {
  const style = figma.getStyleById(styleId);
  if (!style) return;

  const existing = usageMap.get(style.id);
  if (existing) {
    existing.usageCount += 1;
    return;
  }

  usageMap.set(style.id, {
    id: style.id,
    name: style.name,
    styleType: style.type,
    usageCount: 1,
  });
}

// Collect paint/text/effect styles from a single node.
function collectStylesFromNode(node: SceneNode, usageMap: Map<string, StyleUsage>) {
  const fillStyleId = (node as GeometryMixin).fillStyleId;
  if (typeof fillStyleId === "string") {
    incrementStyleUsage(usageMap, fillStyleId);
  }

  const strokeStyleId = (node as GeometryMixin).strokeStyleId;
  if (typeof strokeStyleId === "string") {
    incrementStyleUsage(usageMap, strokeStyleId);
  }

  const effectStyleId = (node as BlendMixin).effectStyleId;
  if (typeof effectStyleId === "string") {
    incrementStyleUsage(usageMap, effectStyleId);
  }

  if ("textStyleId" in node) {
    const textStyleId = node.textStyleId;
    if (typeof textStyleId === "string") {
      incrementStyleUsage(usageMap, textStyleId);
    }
  }
}

// Scan the current selection and publish results to the UI.
function scanSelection() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    selectionState.hasSelection = false;
    selectionState.variables = [];
    selectionState.styles = [];
    figma.ui.postMessage({ type: "selection-data", payload: selectionState });
    return;
  }

  const nodes = getAllSceneNodes(selection);
  const variableUsage = new Map<string, VariableUsage>();
  const styleUsage = new Map<string, StyleUsage>();

  nodes.forEach((node) => {
    collectVariablesFromNode(node as NodeWithBoundVariables, variableUsage);
    collectStylesFromNode(node, styleUsage);
  });

  selectionState.hasSelection = true;
  selectionState.variables = normalizeUsage(variableUsage);
  selectionState.styles = normalizeUsage(styleUsage);

  figma.ui.postMessage({ type: "selection-data", payload: selectionState });
}

// Load available local variables and styles for replacement dropdowns.
async function loadAvailableAssets() {
  const variables = await figma.variables.getLocalVariablesAsync();
  availableAssets.variables = variables.map((variable) => ({
    id: variable.id,
    name: variable.name,
    resolvedType: variable.resolvedType,
    usageCount: 0,
  }));

  const paintStyles = figma.getLocalPaintStyles();
  const textStyles = figma.getLocalTextStyles();
  const effectStyles = figma.getLocalEffectStyles();
  const gridStyles = figma.getLocalGridStyles();

  availableAssets.styles = [...paintStyles, ...textStyles, ...effectStyles, ...gridStyles]
    .map((style) => ({
      id: style.id,
      name: style.name,
      styleType: style.type,
      usageCount: 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  figma.ui.postMessage({ type: "available-assets", payload: availableAssets });
}

// Replace bound variable IDs on the current selection (including children).
function replaceVariables(targetId: string, replacementId: string) {
  const nodes = getAllSceneNodes(figma.currentPage.selection);
  nodes.forEach((node) => {
    const boundVariables = (node as NodeWithBoundVariables).boundVariables;
    if (!boundVariables) return;

    Object.entries(boundVariables).forEach(([property, value]) => {
      if (Array.isArray(value)) {
        if (property === "fills" || property === "strokes") {
          const paints = (node as GeometryMixin)[property];
          if (Array.isArray(paints)) {
            value.forEach((variableId, index) => {
              if (variableId !== targetId) return;
              const paint = paints[index];
              if (!paint) return;
              if (paint.type === "SOLID") {
                (node as NodeWithBoundVariables).setBoundVariableForPaint?.(
                  paint,
                  "color",
                  replacementId,
                );
              }
            });
          }
          return;
        }

        const updated = value.map((variableId) =>
          variableId === targetId ? replacementId : variableId,
        );
        (node as NodeWithBoundVariables).setBoundVariable?.(property, null);
        updated.forEach((variableId) => {
          (node as NodeWithBoundVariables).setBoundVariable?.(property, variableId);
        });
        return;
      }

      if (value === targetId) {
        (node as NodeWithBoundVariables).setBoundVariable?.(property, replacementId);
      }
    });
  });
}

// Replace style IDs across the selection and children.
function replaceStyles(targetId: string, replacementId: string) {
  const nodes = getAllSceneNodes(figma.currentPage.selection);
  nodes.forEach((node) => {
    if ("fillStyleId" in node && node.fillStyleId === targetId) {
      node.fillStyleId = replacementId;
    }

    if ("strokeStyleId" in node && node.strokeStyleId === targetId) {
      node.strokeStyleId = replacementId;
    }

    if ("effectStyleId" in node && node.effectStyleId === targetId) {
      node.effectStyleId = replacementId;
    }

    if ("textStyleId" in node && node.textStyleId === targetId) {
      node.textStyleId = replacementId;
    }
  });
}

figma.on("selectionchange", () => {
  scanSelection();
});

figma.ui.onmessage = (message: PluginMessage) => {
  if (message.type === "ui-ready") {
    loadAvailableAssets();
    scanSelection();
    return;
  }

  if (message.type === "replace") {
    const { kind, targetId, replacementId } = message.payload;
    if (kind === "variable") {
      replaceVariables(targetId, replacementId);
    } else {
      replaceStyles(targetId, replacementId);
    }
    scanSelection();
  }
};
