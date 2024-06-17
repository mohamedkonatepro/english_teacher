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

    const transcriptionPromise = openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
    });

    const threadPromise = await openai.beta.threads.create();

    const [transcriptionResponse, thread] = await Promise.all([transcriptionPromise, threadPromise]);


    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: transcriptionResponse.text
    });

    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID as string,
    });

    let responseMessage = '';

    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(run.thread_id);
      for (const msg of messages.data.reverse()) {
        if (msg.role === 'assistant') {
          if (Array.isArray(msg.content)) {
            msg.content.forEach(content => {
              if (content.type === 'text') {
                responseMessage += `${content.text.value}\n`;
              }
            });
          } else if (typeof msg.content === 'string') {
            responseMessage += `${msg.content}\n`;
          }
        }
      }
    }


    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: responseMessage,
    });

    console.log('responseMessage :::: ', responseMessage)
    // const buffer = Buffer.from(await mp3.arrayBuffer());

    // res.setHeader('Content-Type', 'audio/mpeg');
    // res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    // res.send(buffer);
    // res.status(200).json({ text: responseMessage });


    const speechFile = path.resolve('./public/speech.mp3');
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(speechFile, buffer);

    const audioUrl = '/speech.mp3';
    res.status(200).json({ audioUrl, text: responseMessage });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
