// Omnilingual falsification: PII in 16 languages / 11 scripts must not appear in the bytes forwarded upstream.
// All data is synthetic. Run: JUDGE=1 node test/omni.mjs
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const W = new URL('../src/', import.meta.url).pathname;
const { Vault } = await import(W + 'vault.mjs'), { NounSealer } = await import(W + 'nouns.mjs'), { Wall } = await import(W + 'wall.mjs'), { createServer } = await import(W + 'server.mjs'), { Judge } = await import(W + 'judge.mjs');
const vault = new Vault(mkdtempSync(join(tmpdir(), 'omni-')));
const wall = new Wall({ vault, judge: process.env.JUDGE ? new Judge({ timeoutMs: 120000 }) : null, sealing: process.env.SEALING !== 'off', nouns: new NounSealer({ roots: [] }) });
let cap = [];
const up = http.createServer((q, r) => { let b = []; q.on('data', (c) => b.push(c)); q.on('end', () => { cap.push(Buffer.concat(b).toString('utf8')); r.writeHead(200, { 'content-type': 'application/json' }); r.end('{}'); }); }).listen(0);
const px = createServer({ wall, vault, upstreams: { t: `http://127.0.0.1:${up.address().port}` } }).listen(0);
const send = (text) => fetch(`http://127.0.0.1:${px.address().port}/u/t/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: text }] }) });

// [lang, text, [probes that must not survive]]
const CASES = [
  ['zh', '我叫王小明，电话 +86 138 0013 8000，身份证 110101199003074518，住在北京市朝阳区建国路88号，邮箱 wang.xm@corp-secret.cn', ['王小明', '138 0013 8000', '110101199003074518', '建国路88号', 'corp-secret']],
  ['ja', '私の名前は田中太郎です。電話 090-1234-5678、マイナンバー 123456789012、住所 東京都渋谷区神南1-2-3', ['田中太郎', '090-1234-5678', '123456789012', '神南1-2-3']],
  ['ko', '제 이름은 김민수입니다. 전화 010-1234-5678, 주민등록번호 900101-1234567, 주소 서울특별시 강남구 테헤란로 123', ['김민수', '010-1234-5678', '900101-1234567', '테헤란로 123']],
  ['ar', 'اسمي محمد الفاسي، هاتفي ٠٥٠٥٥٥٠١٣٤، رقم الهوية ١٢٣٤٥٦٧٨٩٠، العنوان شارع الملك فهد ١٢ الرياض', ['محمد الفاسي', '٠٥٠٥٥٥٠١٣٤', '١٢٣٤٥٦٧٨٩٠', 'شارع الملك فهد']],
  ['he', 'שמי דנה כהן, טלפון 050-123-4567, ת.ז. 123456782, רחוב הרצל 15 תל אביב', ['דנה כהן', '050-123-4567', '123456782', 'הרצל 15']],
  ['hi', 'मेरा नाम प्रिया शर्मा है, फोन +91 98765 43210, आधार 1234 5678 9012, PAN ABCDE1234F, पता 12 गांधी रोड दिल्ली', ['प्रिया शर्मा', '98765 43210', '1234 5678 9012', 'ABCDE1234F', 'गांधी रोड']],
  ['ru', 'Меня зовут Иван Петров, паспорт 4509 123456, ИНН 7707083893, телефон +7 495 123-45-67, ул. Тверская, д. 7', ['Иван Петров', '4509 123456', '7707083893', '495 123-45-67', 'Тверская']],
  ['el', 'Με λένε Γιώργος Παπαδόπουλος, ΑΦΜ 123456789, τηλέφωνο +30 210 123 4567, οδός Ερμού 5 Αθήνα', ['Γιώργος Παπαδόπουλος', '123456789', '210 123 4567', 'Ερμού 5']],
  ['th', 'ฉันชื่อสมชาย ใจดี โทร 081-234-5678 เลขบัตรประชาชน 1-1234-12345-12-3 ที่อยู่ 99 ถนนสุขุมวิท กรุงเทพ', ['สมชาย ใจดี', '081-234-5678', '1-1234-12345-12-3', 'ถนนสุขุมวิท']],
  ['es', 'Me llamo José García López, DNI 12345678Z, tel +34 612 345 678, vivo en calle Mayor 12, Madrid', ['José García', '12345678Z', '612 345 678', 'calle Mayor 12']],
  ['de', 'Ich heiße Jürgen Müller, Steuer-ID 12 345 678 901, IBAN DE89 3704 0044 0532 0130 00, Hauptstraße 5, 10115 Berlin', ['Jürgen Müller', '12 345 678 901', 'DE89 3704', 'Hauptstraße 5']],
  ['fr', "Je m'appelle François Dubois, numéro de sécu 1 85 05 78 006 084 36, 12 rue de la Paix, 75002 Paris, tél 06 12 34 56 78", ['François Dubois', '1 85 05 78 006', 'rue de la Paix', '06 12 34 56 78']],
  ['pt', 'Meu nome é João Silva, CPF 123.456.789-09, tel (11) 91234-5678, Rua das Flores 45, São Paulo', ['João Silva', '123.456.789-09', '91234-5678', 'Rua das Flores']],
  ['tr', 'Adım Ayşe Yılmaz, TC kimlik 12345678901, tel 0532 123 45 67, Atatürk Caddesi No 8 İstanbul', ['Ayşe Yılmaz', '12345678901', '0532 123 45 67', 'Atatürk Caddesi']],
  ['vi', 'Tên tôi là Nguyễn Văn An, CCCD 012345678901, điện thoại 0912 345 678, địa chỉ 25 Lê Lợi, Hà Nội', ['Nguyễn Văn An', '012345678901', '0912 345 678', 'Lê Lợi']],
  ['en-gb', 'I am Oliver Smith, NI number AB123456C, mobile 07700 900123, 10 Downing Street London SW1A 2AA', ['Oliver Smith', 'AB123456C', '07700 900123', 'SW1A 2AA']],
  ['keys-in-prose', 'Ключ API: sk-ant-api03-ZZZZYYYYXXXXWWWWVVVV 密钥 AKIAIOSFODNN7EXAMPLE مفتاح ghp_abcdefghijklmnopqrstuvwxyz0123456789', ['ZZZZYYYY', 'AKIAIOSFODNN7', 'ghp_abcdefgh']],
];
let leaks = 0;
for (const [lang, text, probes] of CASES) {
  cap = []; const r = await send(text);
  const body = cap[0] ?? '';
  const left = probes.filter((p) => body.includes(p));
  leaks += left.length;
  console.log(left.length ? 'LEAK' : 'ok  ', lang.padEnd(14), left.length ? JSON.stringify(left) : cap.length ? '' : `(not forwarded ${r.status})`);
}
console.log(`\n${leaks} leaked probes across ${CASES.length} cases (judge ${process.env.JUDGE ? 'ON' : 'off'}, sealing ${process.env.SEALING === 'off' ? 'off' : 'on'})`);
process.exit(0);
