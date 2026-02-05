import React from "react";
import { Button, Stack, Typography } from "@mui/material";

interface QuestionCountControlsProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (nextValue: number) => void;
}

const QuestionCountControls: React.FC<QuestionCountControlsProps> = ({
  value,
  min,
  max,
  step = 5,
  disabled = false,
  onChange,
}) => {
  const safeMin = Math.min(min, max);
  const safeMax = max;
  const clampValue = (nextValue: number) =>
    Math.min(safeMax, Math.max(safeMin, nextValue));
  const adjust = (delta: number) => onChange(clampValue(value + delta));

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems={{ sm: "center" }}
      sx={{ p: 1, minWidth: "fit-content" }}
    >
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          className="room-create-accent-button"
          onClick={() => onChange(safeMin)}
          disabled={disabled || value === safeMin}
        >
          最小
        </Button>
        <Button
          variant="outlined"
          size="small"
          className="room-create-accent-button"
          onClick={() => adjust(-step)}
          disabled={disabled || value <= safeMin}
        >
          -{step}
        </Button>
        <Button
          variant="outlined"
          size="small"
          className="room-create-accent-button"
          onClick={() => adjust(-1)}
          disabled={disabled || value <= safeMin}
        >
          -1
        </Button>
      </Stack>

      <Stack spacing={0.25} alignItems="center" sx={{ minWidth: 120 }}>
        <Typography variant="body2" className="room-create-muted">
          題數
        </Typography>
        <Typography variant="h4" className="room-create-figure">
          {value}
        </Typography>
        <Typography variant="caption" className="room-create-muted">
          {safeMin}–{safeMax}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          className="room-create-accent-button"
          onClick={() => adjust(1)}
          disabled={disabled || value >= safeMax}
        >
          +1
        </Button>
        <Button
          variant="outlined"
          size="small"
          className="room-create-accent-button"
          onClick={() => adjust(step)}
          disabled={disabled || value >= safeMax}
        >
          +{step}
        </Button>
        <Button
          variant="outlined"
          size="small"
          className="room-create-accent-button"
          onClick={() => onChange(safeMax)}
          disabled={disabled || value === safeMax}
        >
          最大
        </Button>
      </Stack>
    </Stack>
  );
};

export default QuestionCountControls;
