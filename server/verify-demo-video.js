// Skip media payloads by their declared box sizes. Only the MP4 header and movie
// metadata are read, including when an exporter writes its moov box after mdat.
function box(buffer, offset, remaining) {
  if (buffer.length - offset < 8) return null;
  let size = buffer.readUInt32BE(offset), header = 8;
  if (size === 1) {
    if (buffer.length - offset < 16) return null;
    size = Number(buffer.readBigUInt64BE(offset + 8)); header = 16;
  }
  if (!size) size = remaining;
  if (!Number.isSafeInteger(size) || size < header || size > remaining) return null;
  return {size, header, type:buffer.toString('ascii',offset+4,offset+8)};
}

function *children(data, type) {
  for (let pos = 0; pos + 8 <= data.length;) {
    const entry = box(data,pos,data.length-pos);
    if (!entry) return;
    if (entry.type === type) yield data.subarray(pos + entry.header,pos + entry.size);
    pos += entry.size;
  }
}

export async function isMp4Video(size, read) {
  if (size < 32) return false;
  let mp4 = false;
  for (let pos = 0, count = 0; pos + 8 <= size && count < 128; count++) {
    const header = await read(pos, Math.min(size - pos, 32));
    const entry = box(header,0,size-pos);
    if (!entry) return false;
    if (entry.type === 'ftyp') {
      if (entry.size < entry.header+8 || entry.size > 1024) return false;
      const data = await read(pos + entry.header,entry.size - entry.header);
      const brands = [data.toString('ascii',0,4)];
      for (let i=8; i+4<=data.length; i+=4) brands.push(data.toString('ascii',i,i+4));
      mp4 = brands.some(brand => /^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash|MSNV)$/.test(brand));
      if (!mp4) return false;
    } else if (entry.type === 'moov') {
      if (!mp4 || entry.size > 12*1024*1024) return false;
      const data = await read(pos + entry.header,entry.size - entry.header);
      for (const track of children(data,'trak')) {
        for (const media of children(track,'mdia')) {
          for (const handler of children(media,'hdlr')) {
            if (handler.toString('ascii',8,12) === 'vide') return true;
          }
        }
      }
      return false;
    }
    pos += entry.size;
  }
  return false;
}
