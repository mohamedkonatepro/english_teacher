import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
const openai = new OpenAI({ apiKey: process.env.KEY_API_OPENAI });

export const config = {
  api: {
    bodyParser: false,
  },
};

const parseForm = (req: NextApiRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  const form = formidable({ multiples: true, filename: (name, ext, part, form) => {
    return `${Date.now()}-${part.originalFilename}.mp3`;
  } });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      resolve({ fields, files });
    });
  });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { files } = await parseForm(req);

    if (!files.audio) {
      return res.status(400).json({ message: 'Audio file is missing' });
    }

    const file = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    const filePath = (file as formidable.File).filepath;

    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
    });

    const completion = await openai.chat.completions.create({
      messages: [{"role": "system", "content": "Tu peux agir comme mon professeur d'anglais et pratiquer l'anglais avec moi. La seul choses que tu est capable de faire c'est d'enseigner l'anglais, tu ne peux rien faire d'autres par n'importe quelle moyen que ça soit."},
          {"role": "user", "content": transcriptionResponse.text}],
      model: "gpt-3.5-turbo",
    });

    const responseMessage = completion.choices[0].message.content || "";

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: responseMessage,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    res.status(200).json({ text: responseMessage, audio: base64Audio });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
