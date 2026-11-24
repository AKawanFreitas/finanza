// Prepara a foto de perfil no navegador: recorta o centro em quadrado e reduz para 256 px em JPEG.
// O arquivo enviado fica pequeno (dezenas de KB) e a foto original, com localização e outros dados, não sai daqui.
const LADO = 256;
const LIMITE_ORIGINAL = 15 * 1024 * 1024;

export async function prepararFoto(arquivo) {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  if (arquivo.size > LIMITE_ORIGINAL) throw new Error('A imagem é grande demais. Escolha uma de até 15 MB.');

  let imagem;
  try {
    imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não consegui abrir essa imagem. Tente um JPG, PNG ou WebP.');
  }

  const lado = Math.min(imagem.width, imagem.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = LADO;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // Fundo branco: PNG com transparência não vira preto ao virar JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LADO, LADO);
  ctx.drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  imagem.close?.();

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Não consegui preparar essa imagem.');
  return blob;
}
