"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { MATERIAL_CATEGORIES } from "@/lib/material-categories";
import {
  MANUFACTURER_IMPORT_STRATEGIES,
  MANUFACTURER_REGISTRY_DEFAULTS,
  type ManufacturerRegistryFormValues,
} from "@/lib/manufacturer-registry-defaults";

interface ManufacturerRegistryFormProps {
  mode: "create" | "edit";
  values: ManufacturerRegistryFormValues;
  isSaving: boolean;
  error?: string | null;
  onChange: (values: ManufacturerRegistryFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ManufacturerRegistryForm({
  mode,
  values,
  isSaving,
  error,
  onChange,
  onSubmit,
  onCancel,
}: ManufacturerRegistryFormProps) {
  function updateField<K extends keyof ManufacturerRegistryFormValues>(
    field: K,
    value: ManufacturerRegistryFormValues[K],
  ) {
    onChange({ ...values, [field]: value });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <CardHeader>
          <CardTitle>
            {mode === "create" ? "Add Manufacturer" : "Edit Manufacturer"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "New manufacturers with Auto Import enabled are included in the next monthly scheduler run automatically."
              : "Changes are saved to the registry and picked up by the monthly scheduler."}
          </CardDescription>
        </CardHeader>

        {error && (
          <div className="mx-6 mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-4 px-6 pb-6 md:grid-cols-2">
          <Input
            label="Manufacturer (company)"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="e.g. 3A Composites"
            required
          />
          <Input
            label="Brand (product line)"
            value={values.brand ?? ""}
            onChange={(event) => updateField("brand", event.target.value || null)}
            placeholder="e.g. ALUCOBOND"
          />
          <Input
            label="Website"
            value={values.website}
            onChange={(event) => updateField("website", event.target.value)}
            placeholder="https://www.example.com"
            required
          />
          <Input
            label="Logo URL"
            value={values.logo_url ?? ""}
            onChange={(event) => updateField("logo_url", event.target.value || null)}
            placeholder="https://…"
          />
          <div className="md:col-span-2">
            <Input
              label="Aliases (comma-separated)"
              value={values.aliases ?? ""}
              onChange={(event) => updateField("aliases", event.target.value)}
              placeholder="Saint-Gobain Glass, Saint-Gobain Glass UK"
            />
            <p className="mt-1 text-xs text-white/35">
              Alternate names merged into this manufacturer — prevents duplicate registry rows.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Category</label>
            <select
              value={values.category}
              onChange={(event) => updateField("category", event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none"
            >
              {MATERIAL_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Import strategy</label>
            <select
              value={values.import_strategy}
              onChange={(event) =>
                updateField(
                  "import_strategy",
                  event.target.value as ManufacturerRegistryFormValues["import_strategy"],
                )
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none"
            >
              {MANUFACTURER_IMPORT_STRATEGIES.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategy}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">
              Import frequency
            </label>
            <select
              value={MANUFACTURER_REGISTRY_DEFAULTS.import_frequency}
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60 focus:outline-none"
            >
              <option value="monthly">Monthly</option>
            </select>
            <p className="mt-1 text-xs text-white/35">
              Weekly and daily scheduling will be added in a future phase.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={values.enabled}
              onChange={(event) => updateField("enabled", event.target.checked)}
            />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={values.auto_import}
              onChange={(event) => updateField("auto_import", event.target.checked)}
            />
            Auto Import
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSaving}>
            {isSaving ? "Saving…" : mode === "create" ? "Add Manufacturer" : "Save Changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
