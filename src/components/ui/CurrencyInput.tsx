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
    
    let numericValue: string;
    
    if (typeof val === "number") {
      // If it's a number, we expect it to be a float like 10.50
      numericValue = Math.round(val * 100).toString();
    } else {
      // If it's a string, it might be a float string "10.50" or a raw digits string from input
      // If it contains a dot, treat it as a float string
      if (val.includes(".")) {
        numericValue = Math.round(parseFloat(val) * 100).toString();
      } else {
        numericValue = val.replace(/\D/g, "");
      }
    }
    
    if (numericValue === "" || numericValue === "NaN") return "";
    
    const floatValue = parseInt(numericValue, 10) / 100;
    
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
