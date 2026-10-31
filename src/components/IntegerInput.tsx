import { maskitoNumber } from "@maskito/kit";
import { useMaskito } from "@maskito/react";
import { TextField } from "@radix-ui/themes";

const integerMask = maskitoNumber({
  min: 0,
  thousandSeparator: "",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

type IntegerInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  width?: string;
};

export function IntegerInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  ariaLabel,
  disabled,
  width,
}: IntegerInputProps) {
  const ref = useMaskito({ options: integerMask });

  return (
    <TextField.Root
      ref={ref}
      id={id}
      inputMode="numeric"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      style={width ? { width } : undefined}
      onBlur={onBlur}
      onInput={(event) => {
        onChange(event.currentTarget.value);
      }}
    />
  );
}
