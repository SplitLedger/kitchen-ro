import { TextField } from "@radix-ui/themes";
import { FormField } from "@/components/FormField";

export function TextFormControl({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <TextField.Root
        id={id}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </FormField>
  );
}
