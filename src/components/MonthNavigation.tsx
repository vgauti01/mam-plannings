import { formatMonthYear } from "../utils/formatters";
import "./MonthNavigation.css";
import {LuChevronLeft, LuChevronRight, LuSettings} from "react-icons/lu";

interface Props {
  currentDate: Date;
  onChange: (newDate: Date) => void;
  openSettings: () => void;
}

export const MonthNavigation = ({ currentDate, onChange, openSettings }: Props) => {
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onChange(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onChange(newDate);
  };

  return (
    <div className="month-nav">
      <button onClick={handlePrev}>
        <LuChevronLeft />
      </button>
      <h2>{formatMonthYear(currentDate)}</h2>
      <button onClick={openSettings}>
        <LuSettings />
      </button>
      <button onClick={handleNext}>
        <LuChevronRight />
      </button>
    </div>
  );
};
