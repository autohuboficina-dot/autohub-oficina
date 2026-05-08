const CHECKLIST_CONFIG_KEY = "autohub:checklist-config";

export const DEFAULT_OS_CHECKLIST_ITEMS = [
  "Freios",
  "Pneus",
  "Óleo",
  "Suspensão",
  "Bateria",
  "Iluminação",
];

function normalizeChecklistItems(items: unknown) {
  if (!Array.isArray(items)) {
    return DEFAULT_OS_CHECKLIST_ITEMS;
  }

  const normalizedItems = items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return normalizedItems.length ? normalizedItems : DEFAULT_OS_CHECKLIST_ITEMS;
}

export function getChecklistConfig() {
  if (typeof localStorage === "undefined") {
    return DEFAULT_OS_CHECKLIST_ITEMS;
  }

  const raw = localStorage.getItem(CHECKLIST_CONFIG_KEY);

  if (!raw) {
    localStorage.setItem(
      CHECKLIST_CONFIG_KEY,
      JSON.stringify(DEFAULT_OS_CHECKLIST_ITEMS),
    );
    return DEFAULT_OS_CHECKLIST_ITEMS;
  }

  try {
    return normalizeChecklistItems(JSON.parse(raw));
  } catch {
    return DEFAULT_OS_CHECKLIST_ITEMS;
  }
}

export function saveChecklistConfig(items: string[]) {
  const normalizedItems = normalizeChecklistItems(items);
  localStorage.setItem(CHECKLIST_CONFIG_KEY, JSON.stringify(normalizedItems));
  return normalizedItems;
}
