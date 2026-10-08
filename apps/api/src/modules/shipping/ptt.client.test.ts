import { describe, expect, it, vi } from "vitest";
import { normalizePttPhone, PttClient, PttError } from "./ptt.client";

const successXml = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body><ns:kabulEkle2Response xmlns:ns="http://kabul.ptt.gov.tr">
    <ns:return><x:aciklama xmlns:x="http://kabul.ptt.gov.tr/xsd">Başarılı</x:aciklama><x:dongu xmlns:x="http://kabul.ptt.gov.tr/xsd"><x:barkod>2750365698456</x:barkod><x:donguAciklama>Kayıt başarılı</x:donguAciklama><x:donguHataKodu>1</x:donguHataKodu><x:donguSonuc>true</x:donguSonuc></x:dongu><x:hataKodu>1</x:hataKodu></ns:return>
  </ns:kabulEkle2Response></soap:Body>
</soap:Envelope>`;

function makeClient(fetchImpl: typeof fetch) {
  return new PttClient({
    environment: "test",
    customerId: "123456789",
    password: "never-log-this-secret",
    fetchImpl,
    timeoutMs: 500,
    uploadUrl: "https://example.test/upload",
    trackingUrl: "https://example.test/tracking",
  });
}

const registration = {
  fileName: "GS1_TEST",
  reference: "GS-T-1",
  recipient: { name: "Ayşe & Test", address: "A < B", city: "Ankara", district: "Çankaya", phone: "05551234567", email: "a@test.invalid" },
  sender: { name: "Gülüm Şalım", address: "Test adresi", city: "İstanbul", district: "Fatih", phone: "+90 555 987 65 43" },
  package: { weightGrams: 850, widthCm: 20, lengthCm: 30, heightCm: 10 },
};

describe("PttClient", () => {
  it("telefonları PTT'nin istediği 10 haneli biçime getirir", () => {
    expect(normalizePttPhone("0555 123 45 67")).toBe("5551234567");
    expect(normalizePttPhone("+90 555 123 45 67")).toBe("5551234567");
    expect(() => normalizePttPhone("123")).toThrow(PttError);
  });

  it("kabulEkle2 isteğini SOAP 1.2 ile üretir, XML'i escape eder ve barkodu ayrıştırır", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = String(init?.body);
      expect(init?.headers).toMatchObject({ "content-type": 'application/soap+xml; charset=UTF-8; action="urn:kabulEkle2"' });
      expect(body).toContain("<svc:kabulEkle2>");
      expect(body).toContain("Ayşe &amp; Test");
      expect(body).toContain("A &lt; B");
      expect(body).toContain("<xsd:agirlik>850</xsd:agirlik>");
      expect(body).toContain("<xsd:desi>2</xsd:desi>");
      return new Response(successXml, { status: 200 });
    }) as typeof fetch;
    const result = await makeClient(fetchMock).registerShipment(registration);
    expect(result).toEqual({ barcode: "2750365698456", code: 1, description: "Kayıt başarılı" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("PTT satır hatasını başarı sanmaz", async () => {
    const xml = successXml
      .replace("<x:barkod>2750365698456</x:barkod>", "")
      .replace("Kayıt başarılı", "Adres hatalı")
      .replace("<x:donguHataKodu>1</x:donguHataKodu>", "<x:donguHataKodu>42</x:donguHataKodu>")
      .replace("<x:donguSonuc>true</x:donguSonuc>", "<x:donguSonuc>false</x:donguSonuc>");
    const client = makeClient(vi.fn(async () => new Response(xml, { status: 200 })) as typeof fetch);
    await expect(client.registerShipment(registration)).rejects.toMatchObject({ code: "PTT_REGISTER_42", unknownOutcome: false });
  });

  it("başarılı kabul barkodu gecikmeli ürettiğinde referansı başarısız saymaz", async () => {
    const xml = successXml.replace("<x:barkod>2750365698456</x:barkod>", "");
    const client = makeClient(vi.fn(async () => new Response(xml, { status: 200 })) as typeof fetch);
    await expect(client.registerShipment(registration)).resolves.toMatchObject({ barcode: null, code: 1 });
  });

  it("kayıt çağrısındaki ağ hatasını belirsiz sonuç olarak işaretler ve secret'ı hataya taşımaz", async () => {
    const client = makeClient(vi.fn(async () => { throw new Error("socket closed"); }) as typeof fetch);
    const error = await client.registerShipment(registration).then(() => null, (value) => value as PttError);
    expect(error).toBeInstanceOf(PttError);
    expect(error).toMatchObject({ code: "PTT_NETWORK_ERROR", unknownOutcome: true, retryable: true });
    expect(error!.message).not.toContain("never-log-this-secret");
  });

  it("PTT SOAP fault içinde geri yansıyan kimlik bilgilerini maskeler", async () => {
    const fault = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><soap:Fault><soap:Reason><soap:Text>123456789 never-log-this-secret geçersiz</soap:Text></soap:Reason></soap:Fault></soap:Body></soap:Envelope>`;
    const client = makeClient(vi.fn(async () => new Response(fault, { status: 200 })) as typeof fetch);
    const error = await client.registerShipment(registration).then(() => null, (value) => value as PttError);
    expect(error!.message).toContain("[PTT_MUSTERI]");
    expect(error!.message).toContain("[PTT_SECRET]");
    expect(error!.message).not.toContain("123456789");
    expect(error!.message).not.toContain("never-log-this-secret");
  });

  it("referansla takip yanıtındaki barkod ve hareketleri ayrıştırır", async () => {
    const trackingXml = `<soap:Envelope xmlns:soap="${"http://www.w3.org/2003/05/soap-envelope"}"><soap:Body><ns:gonderiSorgu_referansNo2Response xmlns:ns="http://takip.ptt.gov.tr"><ns:return><x:BARNO xmlns:x="http://takip.ptt.gov.tr/xsd">2750365698456</x:BARNO><x:TESALAN xmlns:x="http://takip.ptt.gov.tr/xsd"></x:TESALAN><x:dongu xmlns:x="http://takip.ptt.gov.tr/xsd"><x:IMERK>ANKARA</x:IMERK><x:ISLEM>Kabul Edildi</x:ISLEM><x:ITARIH>09/10/2026</x:ITARIH><x:gonderiDurumId>1</x:gonderiDurumId><x:siraNo>1</x:siraNo></x:dongu><x:sonucAciklama xmlns:x="http://takip.ptt.gov.tr/xsd">Başarılı</x:sonucAciklama><x:sonucKodu xmlns:x="http://takip.ptt.gov.tr/xsd">0</x:sonucKodu></ns:return></ns:gonderiSorgu_referansNo2Response></soap:Body></soap:Envelope>`;
    const client = makeClient(vi.fn(async () => new Response(trackingXml, { status: 200 })) as typeof fetch);
    const result = await client.trackByReference("GS-T-1");
    expect(result.found).toBe(true);
    expect(result.barcode).toBe("2750365698456");
    expect(result.events).toEqual([{ sequence: 1, statusId: "1", description: "Kabul Edildi", location: "ANKARA", date: "09/10/2026" }]);
  });

});
