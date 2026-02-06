<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <header class="border-b border-slate-800 px-4 py-3">
      <h1 class="text-lg font-semibold">Variable & Style Manager</h1>
      <p class="text-xs text-slate-400">
        Scan selected nodes and replace variables or styles instantly.
      </p>
    </header>

    <main class="space-y-6 px-4 py-5">
      <div
        v-if="!selection.hasSelection"
        class="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center text-sm text-slate-300"
      >
        Please select a frame or node.
      </div>

      <section v-else class="space-y-4">
        <SectionList
          title="Variables"
          :items="selection.variables"
          :options="available.variables"
          :selections="replacementSelections"
          kind="variable"
          empty-text="No variables found in the current selection."
          @replace="handleReplace"
          @update-selection="updateSelection"
        />

        <SectionList
          title="Styles"
          :items="selection.styles"
          :options="available.styles"
          :selections="replacementSelections"
          kind="style"
          empty-text="No styles found in the current selection."
          @replace="handleReplace"
          @update-selection="updateSelection"
        />
      </section>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive } from "vue";
import SectionList from "./components/SectionList.vue";
import type { AssetKind, AvailableAssetsPayload, SelectionPayload, UiMessage } from "../shared/types";

const selection = reactive<SelectionPayload>({
  hasSelection: false,
  variables: [],
  styles: [],
});

const available = reactive<AvailableAssetsPayload>({
  variables: [],
  styles: [],
});

const replacementSelections = reactive<Record<string, string>>({});

function updateSelection(payload: { id: string; value: string }) {
  replacementSelections[payload.id] = payload.value;
}

function handleReplace(payload: { kind: AssetKind; targetId: string }) {
  const replacementId = replacementSelections[payload.targetId];
  if (!replacementId || replacementId === payload.targetId) return;

  parent.postMessage(
    {
      pluginMessage: {
        type: "replace",
        payload: {
          kind: payload.kind,
          targetId: payload.targetId,
          replacementId,
        },
      },
    },
    "*",
  );

  replacementSelections[payload.targetId] = "";
}

onMounted(() => {
  window.onmessage = (event: MessageEvent<UiMessage>) => {
    const message = event.data.pluginMessage;
    if (!message) return;

    if (message.type === "selection-data") {
      selection.hasSelection = message.payload.hasSelection;
      selection.variables = message.payload.variables;
      selection.styles = message.payload.styles;
      return;
    }

    if (message.type === "available-assets") {
      available.variables = message.payload.variables;
      available.styles = message.payload.styles;
    }
  };

  parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");
});
</script>
