// Phone: a plain text box for the day, written year-month-day, like the other date boxes in the app.
import { Field } from "./ui";

export function DayField({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  return (
    <Field
      label="When did this happen?"
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      keyboardType="numbers-and-punctuation"
      maxLength={10}
    />
  );
}
