import type { InputHTMLAttributes } from "react";

export function Checkbox({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input {...props} type="checkbox" className={`checkbox ${className}`} />;
}
