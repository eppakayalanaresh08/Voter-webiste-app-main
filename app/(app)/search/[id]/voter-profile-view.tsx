'use client';

import NextLink from "next/link";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useParams } from "next/navigation";
import {
  templateByType,
  type FieldContentTemplate,
} from "@/lib/field-content-shared";
import { db, enrich, type OfflineVoter } from "@/lib/offline-db";
import { syncPending } from "@/lib/offline-sync";
import {
  isNativeApp,
  normalizePhoneDigits,
  normalizeWhatsappPhone,
  openSmsComposer,
  openWhatsAppChat,
} from "@/lib/native-bridge";
import {
  isNativePrinterPending,
  printVoterSlipImage,
} from "@/lib/native-printer";
import {
  parseThermalPrintTemplateConfig,
  resolveThermalPrintTemplate,
} from "@/lib/thermal-print-template";
import { renderVoterSlipDataUrl } from "@/lib/voter-slip-renderer";
import {
  buildWhatsAppPreview,
  parseWhatsAppTemplateConfig,
  resolveWhatsAppTemplate,
} from "@/lib/whatsapp-template";

type EditableVoterFields = Pick<
  OfflineVoter,
  | "mobile_no"
  | "notes"
  | "caste"
  | "religion"
  | "aadhar_card_no"
  | "education"
  | "profession"
  | "local_issue"
  | "interested_party"
>;

type EditorMode = "contact" | "notes" | "enrichment" | null;

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "18px",
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
        {value && String(value).trim() ? value : "-"}
      </Typography>
    </Box>
  );
}

export default function VoterProfileClient() {
  const params = useParams<{ id: string }>();
  const voterId = params.id;

  const [voter, setVoter] = useState<OfflineVoter | null>(null);
  const [relatives, setRelatives] = useState<OfflineVoter[]>([]);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [templates, setTemplates] = useState<FieldContentTemplate[]>([]);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [draft, setDraft] = useState<EditableVoterFields>({
    mobile_no: "",
    notes: "",
    caste: "",
    religion: "",
    aadhar_card_no: "",
    education: "",
    profession: "",
    local_issue: "",
    interested_party: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setLoadError("");

      const localVoter = await db.voters.get(voterId);
      if (localVoter) {
        setVoter(localVoter);
        if (localVoter.house_no) {
          const list = await db.voters
            .where("house_lc")
            .equals((localVoter.house_no ?? "").toLowerCase())
            .limit(50)
            .toArray();
          setRelatives(list.filter((x) => x.id !== localVoter.id));
        } else {
          setRelatives([]);
        }
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/voters/${voterId}`);
        const json = (await res.json().catch(() => null)) as {
          error?: string;
          voter?: OfflineVoter;
          relatives?: OfflineVoter[];
          uploadId?: string;
        } | null;

        if (!res.ok || !json?.voter) {
          throw new Error(json?.error ?? "Voter not found");
        }

        const resolvedVoter = enrich(json.voter);
        const resolvedRelatives = (
          (json.relatives ?? []) as OfflineVoter[]
        ).map(enrich);

        await db.transaction("rw", db.voters, async () => {
          await db.voters.put(resolvedVoter);
          if (resolvedRelatives.length) {
            await db.voters.bulkPut(resolvedRelatives);
          }
        });

        if (json.uploadId) {
          await db.meta.put({ key: "upload_id", value: json.uploadId });
        }

        setVoter(resolvedVoter);
        setRelatives(resolvedRelatives);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Failed to load voter",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [voterId]);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch("/api/field-content");
        const json = (await res.json().catch(() => null)) as {
          templates?: FieldContentTemplate[];
        } | null;
        if (res.ok && json?.templates) {
          setTemplates(json.templates);
        }
      } catch {
        // Keep empty state if tenant content is unavailable.
      }
    };

    void loadTemplates();
  }, []);

  const whatsappTemplate = useMemo(() => resolveWhatsAppTemplate(templates), [templates]);
  const thermalPrintTemplate = useMemo(
    () => resolveThermalPrintTemplate(templates),
    [templates],
  );
  const thermalPrintConfig = useMemo(
    () => parseThermalPrintTemplateConfig(thermalPrintTemplate?.body),
    [thermalPrintTemplate?.body],
  );

  const outreachText = useMemo(() => {
    if (!voter) return "";
    return [
      `Hello ${voter.voter_name ?? ""}`,
      `Booth: ${voter.booth_no ?? "-"} - ${voter.booth_name ?? ""}`,
      `EPIC: ${voter.epic_id ?? "-"}`,
      `House No: ${voter.house_no ?? "-"}`,
      `Phone: ${voter.mobile_no ?? "-"}`,
    ].join("\n");
  }, [voter]);

  const whatsappConfig = useMemo(
    () => parseWhatsAppTemplateConfig(whatsappTemplate?.body),
    [whatsappTemplate?.body],
  );

  const whatsappText = useMemo(() => {
    if (!voter) return "";
    if (!whatsappTemplate?.body) return outreachText;
    return buildWhatsAppPreview(whatsappConfig, voter);
  }, [voter, whatsappTemplate?.body, whatsappConfig, outreachText]);

  const logAction = async (actionType: string, payload?: unknown) => {
    if (!voter) return;
    try {
      const res = await fetch("/api/logs/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: voter.id, actionType, payload }),
      });
      if (!res.ok) throw new Error("Failed to sync log");
      setStatus("Logged to Supabase.");
    } catch (error) {
      console.error("[logAction] failed:", error);
      setStatus("Log recording failed (Online only).");
    }
  };

  const openEditor = (mode: Exclude<EditorMode, null>) => {
    if (!voter) return;
    setDraft({
      mobile_no: voter.mobile_no ?? "",
      notes: voter.notes ?? "",
      caste: voter.caste ?? "",
      religion: voter.religion ?? "",
      aadhar_card_no: voter.aadhar_card_no ?? "",
      education: voter.education ?? "",
      profession: voter.profession ?? "",
      local_issue: voter.local_issue ?? "",
      interested_party: voter.interested_party ?? "",
    });
    setEditorMode(mode);
  };

  const saveEdits = async (patch: Partial<EditableVoterFields>) => {
    if (!voter) return;
    const nextVoter = enrich({
      ...voter,
      ...patch,
      updated_at: new Date().toISOString(),
    });
    await db.pendingEdits.add({
      voterId: voter.id,
      patch,
      baseUpdatedAt: voter.updated_at,
      createdAt: new Date().toISOString(),
    });
    await db.voters.put(nextVoter);
    setVoter(nextVoter);
    setStatus("Saved offline. Syncing...");
    void syncPending()
      .then(() => setStatus("Synced to database."))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("No offline pack found")) {
          setStatus("Saved locally. Offline pack not downloaded yet, so sync will happen later.");
          return;
        }
        console.error("[syncPending] failed:", error);
        setStatus(`Saved locally. Sync pending: ${message}`);
      });
  };

  const submitEditor = async () => {
    if (!editorMode) return;
    setIsSaving(true);

    try {
      if (editorMode === "contact") {
        await saveEdits({ mobile_no: draft.mobile_no ?? "" });
      } else if (editorMode === "notes") {
        await saveEdits({ notes: draft.notes ?? "" });
      } else {
        await saveEdits({
          caste: draft.caste ?? "",
          religion: draft.religion ?? "",
          aadhar_card_no: draft.aadhar_card_no ?? "",
          education: draft.education ?? "",
          profession: draft.profession ?? "",
          local_issue: draft.local_issue ?? "",
          interested_party: draft.interested_party ?? "",
        });
      }

      setEditorMode(null);
    } finally {
      setIsSaving(false);
    }
  };

  const [isSendingWa, setIsSendingWa] = useState(false);
  const nativeApp = isNativeApp();
  const shareImageUrl = whatsappTemplate?.imageUrl ?? null;
  const thermalPrintImageUrl = thermalPrintTemplate?.imageUrl ?? null;
  const fallbackWhatsAppImageUrl = "/icons/share.jpeg";

  const generateVoterCardBlob = async (): Promise<Blob> => {
    const imageUrl = shareImageUrl || fallbackWhatsAppImageUrl;
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error("Failed to load WhatsApp share image");
    }
    return response.blob();
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading...
      </Typography>
    );
  }

  if (!voter) {
    return <Alert severity="warning">{loadError || "Voter not found."}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent sx={{ p: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            spacing={2}
            alignItems="flex-start"
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                EPIC
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                {voter.epic_id ?? "-"}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                Booth {voter.booth_no ?? "-"}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 400,
                  color: "primary.main",
                  display: "block",
                }}
              >
                {voter.booth_name || "-"}
              </Typography>
            </Box>
          </Stack>

          <Typography variant="h5" sx={{ mt: 2, fontWeight: 800 }}>
            {voter.voter_name ?? "-"}
          </Typography>
          {voter.voter_name_tamil && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {voter.voter_name_tamil}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            House: {voter.house_no ?? "-"} · Phone: {voter.mobile_no ?? "-"} ·
            Age: {voter.age ?? "-"}
          </Typography>

          <Box
            sx={{
              mt: 2.5,
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 1.25,
            }}
          >
            <Button
              variant="outlined"
              fullWidth
              onClick={async () => {
                if (!voter) return;
                try {
                  setStatus(
                    isNativePrinterPending()
                      ? "Opening native printer bridge..."
                      : "Connecting to printer...",
                  );
                  const slipDataUrl = await renderVoterSlipDataUrl(
                    {
                      voter_name: voter.voter_name,
                      relation_name: voter.relation_name,
                      epic_id: voter.epic_id,
                      booth_no: voter.booth_no,
                      serial_no: voter.serial_no,
                      booth_name: voter.booth_name,
                      booth_address: voter.booth_address,
                    },
                    {
                      imageUrl: thermalPrintImageUrl ?? undefined,
                      template: thermalPrintConfig,
                    },
                  );
                  await printVoterSlipImage(slipDataUrl);
                  await logAction("THERMAL_PRINTED");
                  setStatus("Sent to thermal printer.");
                } catch (error) {
                  console.error(error);
                  setStatus(
                    error instanceof Error
                      ? error.message
                      : "Bluetooth printing failed. Ensure printer is on and paired.",
                  );
                }
              }}
            >
              Bluetooth Print
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={async () => {
                try {
                  const blob = await generateVoterCardBlob();
                  const file = new File(
                    [blob],
                    `voter-${voter.epic_id || voter.id}.png`,
                    {
                      type: "image/png",
                    },
                  );

                  if (
                    navigator.share &&
                    navigator.canShare?.({ files: [file] })
                  ) {
                    await navigator.share({
                      title: "Voter Details",
                      text: whatsappText,
                      files: [file],
                    });
                    await logAction("SHARED");
                    setStatus("Shared successfully.");
                    return;
                  }

                  await navigator.clipboard.writeText(whatsappText);
                  downloadBlob(blob, `voter-${voter.epic_id || voter.id}.png`);
                  await logAction("SHARED", { fallback: "clipboard+download" });
                  setStatus(
                    "Share not supported. Text copied and image downloaded.",
                  );
                } catch (error) {
                  console.error("Share failed:", error);
                  setStatus("Unable to share right now.");
                }
              }}
            >
              Share
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={async () => {
                const phone = normalizePhoneDigits(voter.mobile_no);
                if (!phone) {
                  setStatus("No valid phone number found.");
                  return;
                }
                try {
                  await openSmsComposer(phone, outreachText);
                  await logAction("SMS_OPENED", { phone });
                  setStatus("SMS app opened.");
                } catch (error) {
                  console.error(error);
                  setStatus("Unable to open SMS app.");
                }
              }}
            >
              Send Message
            </Button>

            <Button
              variant="outlined"
              disabled={isSendingWa}
              fullWidth
              onClick={async () => {
                if (!voter) return;
                const phone = normalizeWhatsappPhone(voter.mobile_no);
                if (!phone) {
                  setStatus("No valid phone number found.");
                  return;
                }

                try {
                  setIsSendingWa(true);
                  setStatus("Generating card and sending via WhatsApp...");

                  const blob = await generateVoterCardBlob();
                  const file = new File(
                    [blob],
                    `voter-${voter.epic_id || voter.id}.png`,
                    {
                      type: "image/png",
                    },
                  );

                  const formData = new FormData();
                  const toPhone = phone;
                  formData.append("to", toPhone);
                  formData.append("templateName", whatsappConfig.templateName);
                  formData.append("languageCode", whatsappConfig.languageCode);
                  formData.append("electionState", whatsappConfig.electionState);
                  formData.append("electionYear", whatsappConfig.electionYear);
                  formData.append("assembly", whatsappConfig.assembly);
                  formData.append("voterName", voter.voter_name || "Voter");
                  formData.append("relationName", voter.relation_name || "-");
                  formData.append("boothNo", voter.booth_no || "-");
                  formData.append("serialNo", voter.serial_no || "-");
                  formData.append("epicId", voter.epic_id || "-");
                  formData.append(
                    "boothAddress",
                    [voter.booth_name, voter.booth_address].filter(Boolean).join(", ") || "-"
                  );
                  formData.append("votingDate", whatsappConfig.votingDate);
                  formData.append("votingTime", whatsappConfig.votingTime);
                  formData.append("line12", whatsappConfig.line12);
                  formData.append("line13", whatsappConfig.line13);
                  formData.append("line14", whatsappConfig.line14);
                  formData.append("line15", whatsappConfig.line15);
                  formData.append("line16", whatsappConfig.line16);
                  formData.append("line17", whatsappConfig.line17);
                  formData.append("image", file);

                  const res = await fetch("/api/whatsapp", {
                    method: "POST",
                    body: formData,
                  });

                  const contentType = res.headers.get("content-type");
                  if (contentType && contentType.includes("application/json")) {
                    const json = await res.json();
                    if (!res.ok || !json.success) {
                      throw new Error(
                        JSON.stringify(json.error) ||
                          "Failed to send WhatsApp message",
                      );
                    }

                    const messageId =
                      typeof json.messageId === "string" ? json.messageId : "";
                    await logAction("WHATSAPP_SENT", {
                      phone: toPhone,
                      messageId,
                    });
                    setStatus("WhatsApp message sent successfully!");
                    return;
                  } else {
                    const text = await res.text();
                    throw new Error(
                      `Server returned non-JSON response: ${text}`,
                    );
                  }
                } catch (error: unknown) {
                  const message =
                    error instanceof Error ? error.message : String(error);
                  console.error("WhatsApp Error:", message);

                  if (nativeApp) {
                    try {
                      await openWhatsAppChat(phone, whatsappText || outreachText);
                      await logAction("WHATSAPP_OPENED", { phone, fallback: "api_failed" });
                      setStatus(`WhatsApp API failed, so chat was opened instead: ${message}`);
                    } catch (fallbackError) {
                      const fallbackMessage =
                        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                      setStatus(`WhatsApp failed: ${message}. Fallback open also failed: ${fallbackMessage}`);
                    }
                  } else {
                    setStatus(`WhatsApp failed: ${message}`);
                  }
                } finally {
                  setIsSendingWa(false);
                }
              }}
            >
              {isSendingWa ? "Sending..." : " WhatsApp"}
            </Button>
          </Box>

          {status && (
            <Alert
              severity={status.includes("successfully") ? "success" : "info"}
              sx={{ mt: 2 }}
            >
              {status}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1.5}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Contact & Notes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                View current values first, then edit only when needed.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<EditRoundedIcon />}
                onClick={() => openEditor("contact")}
              >
                Edit Contact
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditRoundedIcon />}
                onClick={() => openEditor("notes")}
              >
                Edit Notes
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={1.5} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <DetailField label="Mobile No" value={voter.mobile_no} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailField label="Notes" value={voter.notes} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1.5}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Enrichment Details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Campaign enrichment and field intelligence fields.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<EditRoundedIcon />}
              onClick={() => openEditor("enrichment")}
            >
              Edit Details
            </Button>
          </Stack>

          <Grid container spacing={1.5} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <DetailField label="Caste" value={voter.caste} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailField label="Religion" value={voter.religion} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailField
                label="Aadhar Card No"
                value={voter.aadhar_card_no}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailField label="Education" value={voter.education} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailField label="Profession" value={voter.profession} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DetailField label="Local Issue" value={voter.local_issue} />
            </Grid>
            <Grid item xs={12}>
              <DetailField
                label="Interested Party"
                value={voter.interested_party}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Relation (same house)
          </Typography>

          <Stack spacing={1.25} sx={{ mt: 1.5 }}>
            {relatives.map((r) => (
              <Card key={r.id} variant="outlined">
                <CardActionArea component={NextLink} href={`/search/${r.id}`}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {r.voter_name}
                    </Typography>
                    {r.voter_name_tamil && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.25 }}
                      >
                        {r.voter_name_tamil}
                      </Typography>
                    )}
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      EPIC: {r.epic_id ?? "-"} · Phone: {r.mobile_no ?? "-"}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}

            {!relatives.length && (
              <Typography variant="body2" color="text.secondary">
                No linked voters found.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={editorMode !== null}
        onClose={() => setEditorMode(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editorMode === "contact"
            ? "Edit Contact"
            : editorMode === "notes"
              ? "Edit Notes"
              : "Edit Enrichment Details"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {editorMode === "contact" && (
              <TextField
                label="Mobile No"
                value={draft.mobile_no ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, mobile_no: e.target.value }))
                }
                fullWidth
              />
            )}

            {editorMode === "notes" && (
              <TextField
                label="Notes"
                value={draft.notes ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, notes: e.target.value }))
                }
                multiline
                minRows={4}
                fullWidth
              />
            )}

            {editorMode === "enrichment" && (
              <>
                <TextField
                  label="Caste"
                  value={draft.caste ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, caste: e.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Religion"
                  value={draft.religion ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, religion: e.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Aadhar Card No"
                  value={draft.aadhar_card_no ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      aadhar_card_no: e.target.value,
                    }))
                  }
                  fullWidth
                />
                <TextField
                  label="Education"
                  value={draft.education ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, education: e.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Profession"
                  value={draft.profession ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      profession: e.target.value,
                    }))
                  }
                  fullWidth
                />
                <TextField
                  label="Local Issue"
                  value={draft.local_issue ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      local_issue: e.target.value,
                    }))
                  }
                  multiline
                  minRows={3}
                  fullWidth
                />
                <TextField
                  label="Interested Party"
                  value={draft.interested_party ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      interested_party: e.target.value,
                    }))
                  }
                  fullWidth
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button
            variant="outlined"
            onClick={() => setEditorMode(null)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void submitEditor()}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
