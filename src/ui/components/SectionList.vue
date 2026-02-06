<template>
  <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold">{{ title }}</h2>
      <span class="text-xs text-slate-400">{{ items.length }} found</span>
    </div>

    <p v-if="items.length === 0" class="text-sm text-slate-400">{{ emptyText }}</p>

    <div v-else class="space-y-3">
      <div
        v-for="item in items"
        :key="item.id"
        class="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-100">{{ item.name }}</p>
            <p class="text-xs uppercase tracking-wide text-slate-500">
              {{ "resolvedType" in item ? item.resolvedType : item.styleType }}
            </p>
          </div>
          <span class="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
            {{ item.usageCount }} uses
          </span>
        </div>

        <div class="mt-3 flex items-center gap-2">
          <select
            :value="selections[item.id] ?? ''"
            class="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            @change="onSelectionChange(item.id, $event)"
          >
            <option value="">Replace with...</option>
            <option
              v-for="option in options"
              :key="option.id"
              :value="option.id"
              :disabled="option.id === item.id"
            >
              {{ option.name }}
            </option>
          </select>
          <button
            class="rounded-md bg-indigo-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-400"
            @click="onReplace(item.id)"
          >
            Replace
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { AssetKind, StyleUsage, VariableUsage } from "../../shared/types";

type Props = {
  title: string;
  kind: AssetKind;
  items: Array<VariableUsage | StyleUsage>;
  options: Array<VariableUsage | StyleUsage>;
  emptyText: string;
  selections: Record<string, string>;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  (event: "replace", payload: { kind: AssetKind; targetId: string }): void;
  (event: "update-selection", payload: { id: string; value: string }): void;
}>();

function onReplace(targetId: string) {
  emit("replace", { kind: props.kind, targetId });
}

function onSelectionChange(targetId: string, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  emit("update-selection", { id: targetId, value });
}
</script>
