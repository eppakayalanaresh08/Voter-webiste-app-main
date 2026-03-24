import { NextResponse } from 'next/server';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "EAAWohgZCblAIBQ4amBrSNaiWZCCFsi2S92ILIzTNHTfB05BGhrHzHbbBdZC2CjSK7gQG98Wp6yruKC1mEKeLzGeny9Bvb07jING1oStpAxzwflZCeZA61XuCOam1vFSHQLgDbd6BZBdHYzKeW4Rl2gIm2pZAnGqBnxGUZARPm1yEJA4A0sHrWgkQekhhGfg88AZDZD";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1074754995713357";
const DEFAULT_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || 'voter_app';
const DEFAULT_LANGUAGE_CODE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';
const EMPTY_TEXT = '\u200B';

function readText(formData: FormData, key: string, fallback = '-') {
  const value = formData.get(key);
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function readOptionalText(formData: FormData, key: string, fallback = EMPTY_TEXT) {
  const value = formData.get(key);
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function renderTemplateValue(value: string, replacements: Record<string, string>) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => replacements[key] ?? '');
}

function ensureTextValue(value: string, fallback = EMPTY_TEXT) {
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const to = readText(formData, 'to', '');
    const templateName = readText(formData, 'templateName', DEFAULT_TEMPLATE_NAME);
    const languageCode = readText(formData, 'languageCode', DEFAULT_LANGUAGE_CODE);
    const electionState = readText(formData, 'electionState', 'State');
    const electionYear = readText(formData, 'electionYear', String(new Date().getFullYear()));
    const assembly = readText(formData, 'assembly', '-');
    const voterName = readText(formData, 'voterName', '-');
    const relationName = readText(formData, 'relationName', '-');
    const epicId = readText(formData, 'epicId', '-');
    const boothNo = readText(formData, 'boothNo', '-');
    const serialNo = readText(formData, 'serialNo', '-');
    const boothAddress = readText(formData, 'boothAddress', '-');
    const votingDate = readText(formData, 'votingDate', '-');
    const votingTime = readText(formData, 'votingTime', '-');
    const line12 = readOptionalText(formData, 'line12');
    const line13 = readOptionalText(formData, 'line13');
    const line14 = readOptionalText(formData, 'line14');
    const line15 = readOptionalText(formData, 'line15');
    const line16 = readOptionalText(formData, 'line16');
    const line17 = readOptionalText(formData, 'line17');
    const imageFile = formData.get('image') as File | null;

    if (!to) {
      return NextResponse.json({ success: false, error: "Missing 'to' phone number" }, { status: 400 });
    }

    const replacements = {
      voter_name: voterName,
      relation_name: relationName,
      epic_id: epicId,
      booth_no: boothNo,
      serial_no: serialNo,
      booth_address: boothAddress,
      assembly,
      electionState,
      electionYear,
      votingDate,
      votingTime
    };

    let mediaId: string | null = null;

    // 1. Upload image to WhatsApp Media API if provided
    if (imageFile) {
      const mediaFormData = new FormData();
      mediaFormData.append('messaging_product', 'whatsapp');
      mediaFormData.append('file', imageFile);

      const mediaRes = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`
        },
        body: mediaFormData
      });

      const mediaData = await mediaRes.json();
      if (!mediaRes.ok) {
        throw new Error(`Media upload failed: ${JSON.stringify(mediaData)}`);
      }
      mediaId = mediaData.id;
    }

    // 2. Send the message with template
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components: [] as unknown[], // WhatsApp payload components
      },
    };

    // If we have an uploaded image, add header component
    if (mediaId) {
      payload.template.components.push({
        type: "header",
        parameters: [
          {
            type: "image",
            image: {
              id: mediaId
            }
          }
        ]
      });
    }

    // Send the 17 body parameters expected by the approved Meta template.
    payload.template.components.push({
      type: "body",
      parameters: [
        { type: "text", text: ensureTextValue(renderTemplateValue(electionState, replacements), '-') }, // {{1}}
        { type: "text", text: ensureTextValue(renderTemplateValue(electionYear, replacements), '-') },  // {{2}}
        { type: "text", text: ensureTextValue(renderTemplateValue(assembly, replacements), '-') },      // {{3}}
        { type: "text", text: ensureTextValue(voterName, '-') },     // {{4}}
        { type: "text", text: ensureTextValue(relationName, '-') },  // {{5}}
        { type: "text", text: ensureTextValue(epicId, '-') },        // {{6}}
        { type: "text", text: ensureTextValue(boothNo, '-') },       // {{7}}
        { type: "text", text: ensureTextValue(serialNo, '-') },      // {{8}}
        { type: "text", text: ensureTextValue(boothAddress, '-') },  // {{9}}
        { type: "text", text: ensureTextValue(renderTemplateValue(votingDate, replacements), '-') },    // {{10}}
        { type: "text", text: ensureTextValue(renderTemplateValue(votingTime, replacements), '-') },    // {{11}}
        { type: "text", text: ensureTextValue(renderTemplateValue(line12, replacements)) },        // {{12}}
        { type: "text", text: ensureTextValue(renderTemplateValue(line13, replacements)) },        // {{13}}
        { type: "text", text: ensureTextValue(renderTemplateValue(line14, replacements)) },        // {{14}}
        { type: "text", text: ensureTextValue(renderTemplateValue(line15, replacements)) },        // {{15}}
        { type: "text", text: ensureTextValue(renderTemplateValue(line16, replacements)) },        // {{16}}
        { type: "text", text: ensureTextValue(renderTemplateValue(line17, replacements)) },        // {{17}}
      ]
    });

    console.log('[whatsapp] payload', JSON.stringify(payload));

    const messageRes = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const messageData = await messageRes.json();
    if (!messageRes.ok) {
      throw new Error(`Message sending failed: ${JSON.stringify(messageData)}`);
    }

    const messageId =
      typeof messageData?.messages?.[0]?.id === 'string'
        ? messageData.messages[0].id
        : null;

    if (!messageId) {
      throw new Error(`Message accepted by API but no message id returned: ${JSON.stringify(messageData)}`);
    }

    return NextResponse.json({
      success: true,
      accepted: true,
      messageId,
      data: messageData,
      payloadPreview: payload
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("WhatsApp Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
