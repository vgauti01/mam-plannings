// src/components/Planning/AddEntryForm.tsx
import { useState } from "react";
import "./AddEntryForm.css";
import { LuPlus } from "react-icons/lu";

interface Props {
  onAdd: (date: string, name: string, start: string, end: string) => void;
}

export const AddEntryForm = ({ onAdd }: Props) => {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [start, setStart] = useState("08h00");
  const [end, setEnd] = useState("17h00");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !name) return;
    onAdd(date, name, start, end);
    setName(""); // Reset nom pour ajout rapide suivant
  };

  return (
    <section className="controls-section">
      <h3>Ajout rapide</h3>
      <form onSubmit={handleSubmit} className="add-form">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Nom de l'enfant"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="time-inputs">
          <input
            type="text"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            pattern="\d{1,2}h\d{2}"
            title="Format: 08h00"
          />
          <span>à</span>
          <input
            type="text"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            pattern="\d{1,2}h\d{2}"
          />
        </div>
        <button className={"btn-secondary"} type="submit">
          <LuPlus />
        </button>
      </form>
    </section>
  );
};
