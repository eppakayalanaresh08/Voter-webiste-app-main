'use client';

import NextLink from "next/link";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { useEffect, useMemo, useRef, useState } from "react";
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
  getDefaultFieldTemplates,
  templateByType,
  type FieldContentTemplate,
} from "@/lib/field-content-shared";
import {
  appendImageToMessage,
  renderMessageTemplate,
} from "@/lib/message-templates";
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
  printVoterSlip,
} from "@/lib/native-printer";

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
  const [templates, setTemplates] = useState<FieldContentTemplate[]>(() =>
    getDefaultFieldTemplates(),
  );
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
        if (res.ok && json?.templates?.length) {
          setTemplates(json.templates);
        }
      } catch {
        // Keep defaults if tenant content is unavailable.
      }
    };

    void loadTemplates();
  }, []);

  const whatsappTemplate = useMemo(
    () => templateByType(templates, "WHATSAPP"),
    [templates],
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

  const whatsappText = useMemo(() => {
    if (!voter) return "";
    const rendered = renderMessageTemplate(whatsappTemplate.body, voter);
    return appendImageToMessage(rendered, whatsappTemplate.imageUrl);
  }, [voter, whatsappTemplate.body, whatsappTemplate.imageUrl]);

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
    void syncPending().then(() => setStatus("Synced to database."));
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
  const voterCardRef = useRef<HTMLDivElement | null>(null);
  const nativeApp = isNativeApp();

  const HEADER_IMAGE_URL =
    "https://firebasestorage.googleapis.com/v0/b/sunya-mobile-app.firebasestorage.app/o/profile_images%2FshzVDMSFFMP9ry5iYhtdWXr0R9m2_1772129528897?alt=media&token=a5cdd474-1b2c-4d95-a90c-57216383c43e";

  const generateVoterCardBlob = async (): Promise<Blob> => {
    if (!voterCardRef.current) throw new Error("Voter card element not found");

    const html2canvasModule = await import("html2canvas");
    const voterCanvas = await html2canvasModule.default(voterCardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const headerImg = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = HEADER_IMAGE_URL;
    });

    const cardW = voterCanvas.width;
    const headerH = headerImg
      ? Math.round((headerImg.naturalHeight / headerImg.naturalWidth) * cardW)
      : 0;

    const combined = document.createElement("canvas");
    combined.width = cardW;
    combined.height = headerH + voterCanvas.height;

    const ctx = combined.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, combined.width, combined.height);

    if (headerImg) {
      ctx.drawImage(headerImg, 0, 0, cardW, headerH);
    }

    ctx.drawImage(voterCanvas, 0, headerH);

    const blob = await new Promise<Blob | null>((resolve) => {
      combined.toBlob((b) => resolve(b), "image/png", 1);
    });

    if (!blob) throw new Error("Failed to generate combined image");
    return blob;
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
                  await printVoterSlip({
                    voter_name: voter.voter_name,
                    voter_name_tamil: voter.voter_name_tamil,
                    booth_no: voter.booth_no,
                    epic_id: voter.epic_id,
                    house_no: voter.house_no,
                    serial_no: voter.serial_no,
                    booth_name: voter.booth_name,
                    mobile_no: voter.mobile_no,
                  });
                  await logAction("THERMAL_PRINTED");
                  setStatus("Sent to thermal printer. 🖨️");
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
                  setStatus("❌ No valid phone number found.");
                  return;
                }

                if (nativeApp) {
                  try {
                    await openWhatsAppChat(phone, whatsappText || outreachText);
                    await logAction("WHATSAPP_OPENED", { phone });
                    setStatus("WhatsApp opened.");
                  } catch (error) {
                    const message =
                      error instanceof Error ? error.message : String(error);
                    setStatus(`❌ WhatsApp open failed: ${message}`);
                  }
                  return;
                }

                try {
                  setIsSendingWa(true);
                  setStatus("⏳ Generating card & sending via WhatsApp...");

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
                  formData.append("voterName", voter.voter_name || "Voter");
                  formData.append("boothNo", voter.booth_no || "-");
                  formData.append("epicId", voter.epic_id || "-");
                  formData.append("houseNo", voter.house_no || "-");
                  formData.append("phoneNo", voter.mobile_no || "-");
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
                  } else {
                    const text = await res.text();
                    throw new Error(
                      `Server returned non-JSON response: ${text}`,
                    );
                  }

                  await logAction("WHATSAPP_SENT", { phone: toPhone });
                  setStatus("✅ WhatsApp message sent automatically!");
                } catch (error: unknown) {
                  const message =
                    error instanceof Error ? error.message : String(error);
                  console.error("WhatsApp Error:", message);
                  setStatus(`❌ WhatsApp failed: ${message}`);
                } finally {
                  setIsSendingWa(false);
                }
              }}
            >
              {nativeApp ? "Open WhatsApp" : isSendingWa ? "Sending..." : "WhatsApp"}
            </Button>
          </Box>

          {status && (
            <Alert severity="info" sx={{ mt: 2 }}>
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

      {/* Hidden share card for html2canvas */}
      <Box
        sx={{
          position: "fixed",
          left: -99999,
          top: 0,
          width: 720,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <Box
          ref={voterCardRef}
          sx={{
            width: 720,
            bgcolor: "#ffffff",
            color: "#111827",
            borderRadius: 3,
            overflow: "hidden",
            border: "2px solid #e5e7eb",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <Box sx={{ px: 3, py: 2, bgcolor: "#1976d2", color: "#fff" }}>
            <Typography sx={{ fontSize: 28, fontWeight: 800 }}>
              Voter Details
            </Typography>
            <Typography sx={{ fontSize: 14, opacity: 0.95 }}>
              Booth Information Slip
            </Typography>
          </Box>

          <Box sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography sx={{ fontSize: 30, fontWeight: 800 }}>
                  {voter.voter_name ?? "-"}
                </Typography>
                {!!voter.voter_name_tamil && (
                  <Typography sx={{ mt: 0.5, fontSize: 18, color: "#4b5563" }}>
                    {voter.voter_name_tamil}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={6}>
                <Box
                  sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: 2 }}
                >
                  <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
                    EPIC ID
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: 22, fontWeight: 700 }}>
                    {voter.epic_id ?? "-"}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6}>
                <Box
                  sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: 2 }}
                >
                  <Typography
                    sx={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}
                  >
                    Booth {voter.booth_no ?? "-"}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.5,
                      fontSize: 16,
                      fontWeight: 400,
                      color: "#1976d2",
                    }}
                  >
                    {voter.booth_name || "-"}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6}>
                <Box
                  sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: 2 }}
                >
                  <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
                    House No
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: 20, fontWeight: 700 }}>
                    {voter.house_no ?? "-"}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6}>
                <Box
                  sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: 2 }}
                >
                  <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
                    Phone
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: 20, fontWeight: 700 }}>
                    {voter.mobile_no ?? "-"}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6}>
                <Box
                  sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: 2 }}
                >
                  <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
                    Serial No
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: 20, fontWeight: 700 }}>
                    {voter.serial_no ?? "-"}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6}>
                <Box
                  sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: 2 }}
                >
                  <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
                    Age
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: 20, fontWeight: 700 }}>
                    {voter.age ?? "-"}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box
                  sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: 2 }}
                >
                  <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
                    Booth Name
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: 18, fontWeight: 700 }}>
                    {voter.booth_name ?? "-"}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Box>
    </Stack>
  );
}
