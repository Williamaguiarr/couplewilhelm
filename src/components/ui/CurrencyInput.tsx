import React, { useEffect, useState } from "react";
import { Input } from "./input";
import { ComponentProps } from "react";

interface CurrencyInputProps extends Omit<ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string | number;
  onChange: (value: string) => void;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState("");

  const formatCurrency = (val: string | number) => {
    if (val === "" || val === null || val === undefined) return "";
    
    // The value prop always represents a numeric amount (e.g. 110 = R$ 110,00).
    // Never treat it as raw digits — that's only for the typing handler below.
    const floatValue = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));

    if (isNaN(floatValue)) return "";
    
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(floatValue);
  };

  useEffect(() => {
    const formatted = formatCurrency(value);
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    
    if (rawValue === "") {
      onChange("");
      return;
    }
    
    const floatValue = parseInt(rawValue, 10) / 100;
    // We pass back the string representation of the number (e.g. "123.45")
    onChange(floatValue.toFixed(2));
  };

  return (
    <Input
      {...props}
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={props.placeholder || "0,00"}
    />
  );
};
