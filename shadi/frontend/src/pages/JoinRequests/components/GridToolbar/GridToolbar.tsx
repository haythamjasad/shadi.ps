import { ServiceType } from "@/types";
import { LoadingButton } from "@mui/lab";
import { Box, Button, Divider, Grid2, Stack, TextField } from "@mui/material";
import {
  GridToolbarProps,
  GridToolbarContainer as MuiGridToolbarContainer,
} from "@mui/x-data-grid";
import { CheckIcon, Eraser, RotateCw, Search } from "lucide-react";
import { FC, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { STATUS_FILTERS } from "./constants";

export interface StaticFilterGridToolbarProps extends GridToolbarProps {
  refetch?: () => void;
  textFilter?: { name: string; phone: string };
  setTextFilter?: (textFilter: { name: string; phone: string }) => void;
  serviceFilter?: ServiceType;
  setServiceFilter?: (serviceFilter: ServiceType | "") => void;
  isFetching?: boolean;
}

const GridToolbar: FC<StaticFilterGridToolbarProps> = ({
  refetch,
  setTextFilter,
  serviceFilter,
  setServiceFilter,
  isFetching,
}) => {
  const { t } = useTranslation("translation");

  const [nameFilter, setNameFilter] = useState<string>("");
  const [phoneFilter, setPhoneFilter] = useState<string>("");

  const isSelected = (item: ServiceType) => serviceFilter === item;
  const selectOne = (item: ServiceType) => {
    setServiceFilter!(item);
  };

  const handleEnterSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setTextFilter!({ name: nameFilter, phone: phoneFilter });
    }
  };

  return (
    <MuiGridToolbarContainer
      sx={{
        flexDirection: { xs: "column", sm: "row" },
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Grid2
        container
        padding={1}
        spacing={1}
        justifyContent="space-between"
        width="100%"
        alignItems="center"
      >
        <Grid2 container size={{ xs: 12, sm: 5 }} alignItems="center">
          <Grid2 size={{ xs: 12, md: 5 }} flexWrap="nowrap">
            <TextField
              label={t("Tables.Headers.name")}
              value={nameFilter}
              onChange={(e) => setNameFilter!(e.target.value)}
              onKeyDown={handleEnterSearch}
              size="small"
              fullWidth
            />
          </Grid2>
          <Grid2 size={{ xs: 12, md: 5 }} flexWrap="nowrap">
            <TextField
              label={t("Tables.Headers.phone")}
              value={phoneFilter}
              onChange={(e) => setPhoneFilter!(e.target.value)}
              onKeyDown={handleEnterSearch}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  style: {
                    direction: "ltr",
                  },
                },
              }}
            />
          </Grid2>
          <Grid2 size={{ xs: 12, md: 2 }} flexWrap="nowrap">
            <LoadingButton
              variant="outlined"
              endIcon={<Search size={18} />}
              loading={isFetching}
              onClick={() =>
                setTextFilter!({ name: nameFilter, phone: phoneFilter })
              }
              sx={{ minWidth: "100px" }}
            >
              <Trans i18nKey="Buttons.search">Search</Trans>
            </LoadingButton>
          </Grid2>
        </Grid2>
        <Grid2 container size={{ xs: 12, sm: 5 }} justifyContent="center">
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {STATUS_FILTERS.map((item) => (
              <Box
                key={item.label}
                onClick={() => selectOne(item.value)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1.6,
                  py: 0.7,
                  borderRadius: 3,
                  fontSize: 14,
                  border: "1px solid",
                  borderColor: isSelected(item.value) ? "primary.main" : "#ccc",
                  backgroundColor: isSelected(item.value)
                    ? "rgba(25, 118, 210, 0.08)"
                    : "transparent",
                  color: isSelected(item.value)
                    ? "primary.main"
                    : "text.primary",
                  userSelect: "none",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-evenly"
                  alignItems="center"
                  minWidth={82}
                >
                  {isSelected(item.value) && (
                    <div
                      style={{
                        transform: "scaleX(-1) !important",
                        width: 30,
                        height: 20,
                      }}
                    >
                      <CheckIcon fontSize="small" />
                    </div>
                  )}

                  {item.label}
                </Stack>
              </Box>
            ))}
          </Box>
        </Grid2>
        <Grid2 container justifyContent="end">
          {!!refetch && (
            <Grid2 flexWrap="nowrap">
              <LoadingButton
                variant="contained"
                endIcon={<RotateCw size={18} />}
                loading={isFetching}
                onClick={() => refetch()}
                sx={{ minWidth: "100px" }}
              >
                <Trans i18nKey="Buttons.refresh">Refresh</Trans>
              </LoadingButton>
            </Grid2>
          )}
          <Grid2 flexWrap="nowrap">
            <Button
              variant="outlined"
              onClick={() => {
                setTextFilter!({ name: "", phone: "" });
                setServiceFilter!("");
                setNameFilter("");
                setPhoneFilter("");
              }}
              endIcon={<Eraser size={18} />}
            >
              <Trans i18nKey="Buttons.resetFilters">Reset</Trans>
            </Button>
          </Grid2>
        </Grid2>
      </Grid2>

      <Divider sx={{ width: "100%" }} />
    </MuiGridToolbarContainer>
  );
};

export default GridToolbar;
