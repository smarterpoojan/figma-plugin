export type AssetKind = "variable" | "style";

export type VariableUsage = {
  id: string;
  name: string;
  resolvedType: string;
  usageCount: number;
};

export type StyleUsage = {
  id: string;
  name: string;
  styleType: string;
  usageCount: number;
};

export type SelectionPayload = {
  hasSelection: boolean;
  variables: VariableUsage[];
  styles: StyleUsage[];
};

export type AvailableAssetsPayload = {
  variables: VariableUsage[];
  styles: StyleUsage[];
};

export type UiReadyMessage = {
  type: "ui-ready";
};

export type SelectionMessage = {
  type: "selection-data";
  payload: SelectionPayload;
};

export type AvailableAssetsMessage = {
  type: "available-assets";
  payload: AvailableAssetsPayload;
};

export type ReplaceRequestMessage = {
  type: "replace";
  payload: {
    kind: AssetKind;
    targetId: string;
    replacementId: string;
  };
};

export type PluginMessage = UiReadyMessage | ReplaceRequestMessage;
export type UiMessage = SelectionMessage | AvailableAssetsMessage;
