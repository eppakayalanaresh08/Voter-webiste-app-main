import { NextResponse } from 'next/server';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "EAAWohgZCblAIBQ4amBrSNaiWZCCFsi2S92ILIzTNHTfB05BGhrHzHbbBdZC2CjSK7gQG98Wp6yruKC1mEKeLzGeny9Bvb07jING1oStpAxzwflZCeZA61XuCOam1vFSHQLgDbd6BZBdHYzKeW4Rl2gIm2pZAnGqBnxGUZARPm1yEJA4A0sHrWgkQekhhGfg88AZDZD";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1074754995713357";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const to = formData.get('to') as string;
    const voterName = formData.get('voterName') as string || '-';
    const boothNo = formData.get('boothNo') as string || '-';
    const epicId = formData.get('epicId') as string || '-';
    const houseNo = formData.get('houseNo') as string || '-';
    const phoneNo = formData.get('phoneNo') as string || '-';
    const imageFile = formData.get('image') as File | null;

    if (!to) {
      return NextResponse.json({ success: false, error: "Missing 'to' phone number" }, { status: 400 });
    }

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
        name: "voter_app",
        language: {
          code: "en",
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

    // Add generic body parameters (we pass the epicId or a default number as expected by the template)
    payload.template.components.push({
      type: "body",
      parameters: [
        { type: "text", text: voterName }, // {{1}} Name
        { type: "text", text: boothNo },   // {{2}} Booth
        { type: "text", text: epicId },    // {{3}} EPIC
        { type: "text", text: houseNo },   // {{4}} House No
        { type: "text", text: phoneNo },   // {{5}} Phone
      ]
    });

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

    return NextResponse.json({ success: true, data: messageData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("WhatsApp Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
