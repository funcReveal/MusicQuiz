import React from "react";
import { Button, Stack, TextField, Typography } from "@mui/material";

type RoomVisibility = "public" | "private";

interface RoomAccessSettingsFieldsProps {
  visibility: RoomVisibility;
  password: string;
  disabled?: boolean;
  allowPasswordWhenPublic?: boolean;
  showClearButton?: boolean;
  passwordFieldVariant?: "outlined" | "standard" | "filled";
  passwordFieldSize?: "small" | "medium";
  passwordFieldLabelShrink?: boolean;
  onVisibilityChange: (value: RoomVisibility) => void;
  onPasswordChange: (value: string) => void;
  onPasswordClear?: () => void;
  classes?: {
    root?: string;
    visibilityRow?: string;
    visibilityButton?: string;
    helperText?: string;
    passwordField?: string;
    noteText?: string;
  };
}

const RoomAccessSettingsFields: React.FC<RoomAccessSettingsFieldsProps> = ({
  visibility,
  password,
  disabled = false,
  allowPasswordWhenPublic = false,
  showClearButton = true,
  passwordFieldVariant = "outlined",
  passwordFieldSize = "small",
  passwordFieldLabelShrink = false,
  onVisibilityChange,
  onPasswordChange,
  onPasswordClear,
  classes,
}) => {
  const passwordEnabled =
    !disabled && (allowPasswordWhenPublic || visibility === "private");

  const visibilityHint =
    visibility === "private"
      ? "私人房間不會出現在房間列表，僅能透過邀請連結加入。"
      : "公開房間會顯示在房間列表，任何人都能搜尋並加入。";

  const passwordHint = allowPasswordWhenPublic
    ? "公開與私人房間都可設定密碼；留空代表不需要。"
    : visibility === "private"
      ? "密碼為選填；若有設定，加入時需要輸入。"
      : "公開房間通常不需要密碼，可留空。";

  return (
    <Stack spacing={1.25} className={classes?.root}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        className={classes?.visibilityRow}
      >
        <Button
          variant={visibility === "public" ? "contained" : "outlined"}
          onClick={() => onVisibilityChange("public")}
          disabled={disabled}
          className={classes?.visibilityButton}
        >
          公開
        </Button>
        <Button
          variant={visibility === "private" ? "contained" : "outlined"}
          onClick={() => onVisibilityChange("private")}
          disabled={disabled}
          className={classes?.visibilityButton}
        >
          私人
        </Button>
      </Stack>

      <Typography variant="caption" className={classes?.helperText}>
        {visibilityHint}
      </Typography>

      <TextField
        size={passwordFieldSize}
        variant={passwordFieldVariant}
        slotProps={{ inputLabel: { shrink: passwordFieldLabelShrink } }}
        label="房間密碼（選填）"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        placeholder="可留空"
        disabled={!passwordEnabled}
        fullWidth
        className={classes?.passwordField}
      />

      <Stack direction="row" spacing={1} alignItems="center">
        {showClearButton && (
          <Button
            size="small"
            variant="outlined"
            onClick={onPasswordClear}
            disabled={disabled || !password || !onPasswordClear}
          >
            清除
          </Button>
        )}
        <Typography variant="caption" className={classes?.noteText}>
          {passwordHint}
        </Typography>
      </Stack>
    </Stack>
  );
};

export default RoomAccessSettingsFields;
