/**
 * خادم API لموقع "القاهرة التاريخية"
 * ------------------------------------------------------------
 * يوفر هذا الخادم نقاط اتصال (Endpoints) بسيطة لـ:
 *  - حفظ حجوزات الجولات / المطاعم / الفنادق
 *  - حفظ طلبات متجر الهدايا
 *  - بدء عملية دفع (Payment Initiation) عبر بوابات الدفع الفوري المصرية
 *
 * ملاحظة مهمة حول الدفع الفوري:
 * لا يمكن لأي طرف ثالث (بما في ذلك هذا الكود) إجراء عمليات دفع حقيقية
 * دون حساب تاجر (Merchant Account) رسمي لدى مزود الخدمة. لذلك تم بناء
 * دالة initiatePayment() كواجهة موحّدة (adapter) تُحاكي الاستجابة الآن،
 * وتحتاج فقط لاستبدال الجزء الداخلي بطلب HTTP حقيقي بعد حصولك على:
 *   - InstaPay:      مفاتيح API من بنكك المُصدر / البنك المركزي المصري
 *   - Fawry:         Merchant Code + Security Key من بوابة "فوري بيزنس"
 *   - Meeza / فيزا:  حساب دفع إلكتروني من مزود بوابة دفع مرخّص (مثل Paymob أو Fawry)
 *   - Vodafone Cash:  عبر نفس بوابات الدفع المجمّعة (Paymob/Fawry) التي تدعمها
 *
 * الأسهل عمليًا: التسجيل في بوابة دفع مجمّعة مرخّصة في مصر مثل Paymob
 * (paymob.com) والتي تمنحك مفتاح API واحد يغطي InstaPay وMeeza وفودافون
 * كاش وفوري وبطاقات الائتمان معًا، بدل التكامل مع كل جهة منفردة.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { nanoid } = require("nanoid");

const app = express();
app.use(cors());
app.use(express.json());

// ---------- تخزين مؤقت في الذاكرة (استبدله بقاعدة بيانات حقيقية مثل MongoDB/Postgres لاحقًا) ----------
const bookings = [];
const orders = [];

// ---------- نقاط الحجوزات (جولات / مطاعم / فنادق) ----------
app.post("/api/bookings", (req, res) => {
  const { title, name, date, guests, paymentMethod } = req.body;
  if (!title || !name || !date) {
    return res.status(400).json({ ok: false, error: "الرجاء إدخال الاسم والتاريخ ونوع الحجز" });
  }
  const booking = {
    id: nanoid(10),
    title,
    name,
    date,
    guests: guests || 1,
    paymentMethod: paymentMethod || "InstaPay",
    status: "بانتظار الدفع",
    createdAt: new Date().toISOString(),
  };
  bookings.push(booking);
  res.json({ ok: true, booking });
});

app.get("/api/bookings", (_req, res) => {
  res.json({ ok: true, count: bookings.length, bookings });
});

// ---------- نقاط طلبات متجر الهدايا ----------
app.post("/api/orders", (req, res) => {
  const { items, address, paymentMethod } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ ok: false, error: "السلة فارغة" });
  }
  const order = {
    id: nanoid(10),
    items,
    address: address || "",
    paymentMethod: paymentMethod || "InstaPay",
    status: "بانتظار الدفع",
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  res.json({ ok: true, order });
});

app.get("/api/orders", (_req, res) => {
  res.json({ ok: true, count: orders.length, orders });
});

// ---------- بدء عملية الدفع الفوري ----------
app.post("/api/payments/initiate", async (req, res) => {
  const { refId, refType, amount, method } = req.body;
  if (!refId || !amount) {
    return res.status(400).json({ ok: false, error: "بيانات الدفع غير مكتملة" });
  }

  try {
    const paymentResult = await initiatePayment({ refId, refType, amount, method });
    res.json({ ok: true, ...paymentResult });
  } catch (err) {
    res.status(500).json({ ok: false, error: "تعذّر بدء عملية الدفع", details: err.message });
  }
});

/**
 * adapter الدفع — استبدل المحتوى الداخلي بطلب حقيقي لبوابة الدفع
 * بعد حصولك على مفاتيح API. المثال أدناه موضّح بتعليقات لـ Paymob
 * كونها الأكثر شيوعًا لتجميع InstaPay وMeeza وفودافون كاش وفوري في مصر.
 */
async function initiatePayment({ refId, refType, amount, method }) {
  const provider = process.env.PAYMENT_PROVIDER; // مثال: "paymob"
  const apiKey = process.env.PAYMENT_API_KEY;

  if (!provider || !apiKey) {
    // وضع تجريبي (Demo Mode) — لا يوجد اتصال حقيقي ببوابة دفع بعد
    return {
      mode: "demo",
      reference: `DEMO-${nanoid(8).toUpperCase()}`,
      redirectUrl: null,
      message: "تم إنشاء الحجز/الطلب بنجاح في وضع العرض التجريبي. لتفعيل الدفع الحقيقي أضف مفاتيح بوابة الدفع في ملف .env",
    };
  }

  // ---- مثال حقيقي (معطّل افتراضيًا) لبوابة Paymob ----
  // const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ api_key: apiKey }),
  // });
  // const { token } = await authRes.json();
  // ... إنشاء طلب الدفع، ثم استخراج رابط الدفع (iframe/redirect) وإعادته للواجهة الأمامية

  return {
    mode: "live",
    reference: `${provider.toUpperCase()}-${nanoid(8).toUpperCase()}`,
    redirectUrl: "REPLACE_WITH_REAL_PAYMENT_URL",
  };
}

// ---------- صديق الرحلة: وكيل (proxy) لواجهة Claude API ----------
// يبقي مفتاح Anthropic API على الخادم فقط ولا يُعرَّض أبدًا في متصفح الزائر.
const GUIDE_SYSTEM_PROMPT = `أنت "صديق الرحلة"، مرشد سياحي ودود وخبير متخصص حصريًا في القاهرة التاريخية
(القاهرة الفاطمية/الإسلامية، القاهرة القبطية، أسوارها وأبوابها، أسواقها وحِرَفها، مطاعمها
ومقاهيها التراثية، فنادقها، ومواصلاتها بما فيها خطوط المترو الثلاثة).
تحدّث دائمًا بالعربية الفصحى المبسطة الودودة، بإجابات مختصرة ومفيدة (٣-٦ جمل عادة، أو نقاط
قصيرة عند الحاجة)، واقترح خطوات عملية عندما يكون ذلك مناسبًا (مثل أقرب محطة مترو، أو مدة
الزيارة المقترحة). إن سُئلت عن موضوع خارج القاهرة التاريخية ووسائل السياحة فيها، وجّه الحديث
بلطف نحو ما يمكنك مساعدته فيه داخل هذا الموقع. لا تخترع أسعارًا أو مواعيد دقيقة غير مؤكدة؛
اذكرها كتقديرات عامة عند الحاجة.`;

app.post("/api/guide/chat", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !messages.length) {
    return res.status(400).json({ ok: false, error: "لا توجد رسالة" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({
      ok: true,
      demo: true,
      reply: "ميزة \"صديق الرحلة\" تحتاج مفتاح Anthropic API على الخادم لتعمل بشكل حقيقي. أضف ANTHROPIC_API_KEY في ملف .env (راجع backend/README.md).",
    });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 700,
        system: GUIDE_SYSTEM_PROMPT,
        messages,
      }),
    });
    const data = await r.json();
    const reply = (data.content || []).map((b) => b.text || "").join("\n") || "لم أتمكن من توليد رد الآن.";
    res.json({ ok: true, reply });
  } catch (err) {
    res.status(500).json({ ok: false, error: "تعذّر الوصول لخدمة صديق الرحلة", details: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ خادم القاهرة التاريخية يعمل على المنفذ ${PORT}`);
});
