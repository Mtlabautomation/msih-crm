// MSIH CRM V1.0 — Database Seed (importable from /api/setup)
// Developer: Manoj Dore
// Run: bun run db:seed  (CLI)  OR  POST /api/setup  (web)

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

const PRODUCT_CATEGORIES = [
  {
    name: "ZEISS Primotech Microscope",
    category: "ZEISS Microscopes",
    description: "Compact upright microscope for routine material analysis with smart automation features and integrated imaging.",
    specifications: { "Magnification": "5x - 500x", "Illumination": "LED reflected/transmitted", "Camera": "5MP Axiocam", "Stage": "Mechanical X/Y 75x50mm" },
    applications: ["Quality Control", "Metallurgy", "Material Inspection", "Failure Analysis"],
    industries: ["Automotive", "Aerospace", "Metallurgy"],
    basePrice: 1850000,
  },
  {
    name: "ZEISS Axio Vert A1",
    category: "ZEISS Microscopes",
    description: "Inverted microscope for large samples, ideal for metallurgical inspection and coating analysis.",
    specifications: { "Magnification": "5x - 1000x", "Stand": "Inverted", "Illumination": "LED/Halogen", "Camera": "Axiocam 208 color" },
    applications: ["Coating Thickness", "Grain Size Analysis", "Microstructure"],
    industries: ["Metallurgy", "Plating", "Automotive"],
    basePrice: 2450000,
  },
  {
    name: "Micro Vickers Hardness Tester MVH-1",
    category: "Micro Vickers Hardness Testers",
    description: "Automatic micro Vickers hardness tester with CCD camera and software for precise measurement of thin films and small parts.",
    specifications: { "Load Range": "10gf - 2kgf", "Objective": "10x, 40x", "Display": "Touchscreen LCD", "Standard": "ISO 6507, ASTM E384" },
    applications: ["Thin Films", "Small Parts", "Surface Hardness"],
    industries: ["Aerospace", "Electronics", "Precision Engineering"],
    basePrice: 685000,
  },
  {
    name: "Rockwell Hardness Tester RHT-3",
    category: "Rockwell Hardness Testers",
    description: "Digital Rockwell hardness tester with closed-loop load cell technology for accurate and repeatable testing.",
    specifications: { "Load": "60/100/150 kgf", "Scales": "HRA, HRB, HRC", "Display": "Digital", "Standard": "ISO 6508, ASTM E18" },
    applications: ["Steel Hardness", "Heat Treatment QC", "Forging Inspection"],
    industries: ["Steel", "Automotive", "Heavy Engineering"],
    basePrice: 425000,
  },
  {
    name: "Brinell Hardness Tester BHT-2",
    category: "Brinell Hardness Testers",
    description: "Heavy-duty Brinell hardness tester for castings, forgings, and large components with optical measurement.",
    specifications: { "Load": "500 - 3000 kgf", "Method": "Carbide Ball 5/10mm", "Display": "Digital", "Standard": "ISO 6506, ASTM E10" },
    applications: ["Castings", "Forgings", "Soft Metals"],
    industries: ["Foundry", "Steel", "Automotive"],
    basePrice: 565000,
  },
  {
    name: "Vickers Hardness Tester VHT-1",
    category: "Vickers Hardness Testers",
    description: "Versatile Vickers hardness tester with both micro and macro load ranges for lab and production use.",
    specifications: { "Load": "1kgf - 50kgf", "Objective": "10x, 40x", "Display": "LCD", "Standard": "ISO 6507, ASTM E92" },
    applications: ["Lab Testing", "Heat Treated Parts", "Weld Inspection"],
    industries: ["Metallurgy", "Oil & Gas", "Manufacturing"],
    basePrice: 545000,
  },
  {
    name: "Abrasive Cutting Machine ACM-35",
    category: "Abrasive Cutting Machines",
    description: "Precision abrasive cutter for metallurgical sample preparation with large cutting capacity and cooling system.",
    specifications: { "Wheel Size": "355mm", "Max Cut": "100mm dia", "Motor": "3 HP", "Cooling": "Recirculating" },
    applications: ["Sample Preparation", "Metallurgical Cutting"],
    industries: ["Metallurgy", "Quality Labs", "Research"],
    basePrice: 285000,
  },
  {
    name: "Metallographic Polishing Machine MPM-8",
    category: "Metallographic Polishing Machines",
    description: "Double-disc automatic metallographic polisher for preparing samples for microscopic examination.",
    specifications: { "Disc Size": "200mm x 2", "Speed": "50-500 rpm", "Motor": "0.5 HP", "Control": "Variable" },
    applications: ["Sample Polishing", "Surface Finishing"],
    industries: ["Metallurgy", "Materials Science"],
    basePrice: 195000,
  },
  {
    name: "Hot Mounting Press HMP-1",
    category: "Hot Mounting Presses",
    description: "Automatic hot mounting press for embedding samples in resin for metallographic preparation.",
    specifications: { "Capacity": "30mm, 40mm molds", "Heating": "Up to 200°C", "Pressure": "Up to 300 bar", "Cycle": "Auto" },
    applications: ["Sample Mounting", "Edge Retention"],
    industries: ["Metallurgy", "Quality Labs"],
    basePrice: 165000,
  },
  {
    name: "Muffle Furnace MF-12",
    category: "Muffle Furnaces",
    description: "Laboratory muffle furnace for ashing, heat treatment, and material testing up to 1200°C.",
    specifications: { "Max Temp": "1200°C", "Chamber": "5L", "Heating": "Kanthal", "Control": "PID Digital" },
    applications: ["Ash Content", "Heat Treatment", "Loss on Ignition"],
    industries: ["Cement", "Food", "Chemicals", "Mining"],
    basePrice: 145000,
  },
  {
    name: "Industrial Box Furnace IBF-1400",
    category: "Industrial Furnaces",
    description: "Industrial-grade box furnace for high-temperature heat treatment applications up to 1400°C.",
    specifications: { "Max Temp": "1400°C", "Chamber": "60L", "Heating": "SiC Elements", "Control": "Programmable" },
    applications: ["Annealing", "Hardening", "Sintering", "Stress Relieving"],
    industries: ["Steel", "Ceramics", "Aerospace"],
    basePrice: 985000,
  },
  {
    name: "Calibration Service — Hardness Testers",
    category: "Calibration Services",
    description: "NABL-accredited on-site calibration services for Rockwell, Brinell, and Vickers hardness testers with traceable reference blocks.",
    specifications: { "Standard": "ISO 6506/6507/6508", "Accreditation": "NABL", "Certificate": "Issued", "Validity": "1 Year" },
    applications: ["Annual Calibration", "Compliance", "ISO Audit"],
    industries: ["All Manufacturing"],
    basePrice: 15000,
  },
];

export async function main() {
  console.log("🌱 Seeding MSIH CRM V1.0...");

  // 1. Create users
  const pwd = await bcrypt.hash("admin@123", 10);
  const users = await Promise.all([
    db.user.upsert({
      where: { email: "superadmin@mettechnik.com" },
      update: {},
      create: {
        email: "superadmin@mettechnik.com",
        name: "Manoj Dore",
        password: pwd,
        role: "SUPER_ADMIN",
        phone: "+91 98765 43210",
        employeeId: "MT-001",
        designation: "Director / Super Admin",
        city: "Pune",
        state: "Maharashtra",
      },
    }),
    db.user.upsert({
      where: { email: "admin@mettechnik.com" },
      update: {},
      create: {
        email: "admin@mettechnik.com",
        name: "Anil Deshpande",
        password: pwd,
        role: "ADMIN",
        phone: "+91 98765 11111",
        employeeId: "MT-002",
        designation: "System Administrator",
        city: "Pune",
        state: "Maharashtra",
      },
    }),
    db.user.upsert({
      where: { email: "manager@mettechnik.com" },
      update: {},
      create: {
        email: "manager@mettechnik.com",
        name: "Rohit Sharma",
        password: pwd,
        role: "MANAGER",
        phone: "+91 98765 22222",
        employeeId: "MT-003",
        designation: "Sales Manager",
        city: "Pune",
        state: "Maharashtra",
      },
    }),
    db.user.upsert({
      where: { email: "rohit@mettechnik.com" },
      update: {},
      create: {
        email: "rohit@mettechnik.com",
        name: "Rohit Verma",
        password: pwd,
        role: "EXECUTIVE",
        phone: "+91 98765 33333",
        employeeId: "MT-004",
        designation: "Sales Executive",
        city: "Pune",
        state: "Maharashtra",
      },
    }),
    db.user.upsert({
      where: { email: "priya@mettechnik.com" },
      update: {},
      create: {
        email: "priya@mettechnik.com",
        name: "Priya Nair",
        password: pwd,
        role: "EXECUTIVE",
        phone: "+91 98765 44444",
        employeeId: "MT-005",
        designation: "Sales Executive",
        city: "Mumbai",
        state: "Maharashtra",
      },
    }),
    db.user.upsert({
      where: { email: "amit@mettechnik.com" },
      update: {},
      create: {
        email: "amit@mettechnik.com",
        name: "Amit Kulkarni",
        password: pwd,
        role: "EXECUTIVE",
        phone: "+91 98765 55555",
        employeeId: "MT-006",
        designation: "Sales Executive",
        city: "Nashik",
        state: "Maharashtra",
      },
    }),
  ]);

  const [superAdmin, admin, manager, rohit, priya, amit] = users;
  const execs = [rohit, priya, amit];
  console.log(`✅ Created ${users.length} users`);

  // 2. Create products
  const products = await Promise.all(
    PRODUCT_CATEGORIES.map((p) =>
      db.product.upsert({
        where: { name: p.name },
        update: {},
        create: {
          name: p.name,
          category: p.category,
          description: p.description,
          specifications: JSON.stringify(p.specifications),
          applications: JSON.stringify(p.applications),
          industries: JSON.stringify(p.industries),
          basePrice: p.basePrice,
          unit: "Unit",
          active: true,
        },
      })
    )
  );
  console.log(`✅ Created ${products.length} products`);

  // 3. Create customers
  const customerData = [
    { company: "Tata Steel Ltd", contactPerson: "Rajesh Iyer", mobile: "+91 99300 12345", email: "rajesh.iyer@tatasteel.com", city: "Jamshedpur", state: "Jharkhand", industry: "Steel" },
    { company: "Mahindra & Mahindra", contactPerson: "Sneha Patil", mobile: "+91 98200 23456", email: "sneha.patil@mahindra.com", city: "Mumbai", state: "Maharashtra", industry: "Automotive" },
    { company: "Bharat Forge Ltd", contactPerson: "Vikram Joshi", mobile: "+91 99220 34567", email: "vikram@bharatforge.com", city: "Pune", state: "Maharashtra", industry: "Forging" },
    { company: "Larsen & Toubro", contactPerson: "Anjali Mehta", mobile: "+91 98190 45678", email: "anjali.mehta@lnt.com", city: "Mumbai", state: "Maharashtra", industry: "Heavy Engineering" },
    { company: "ISRO - Space Application Centre", contactPerson: "Dr. Subbarao", mobile: "+91 99110 56789", email: "subbarao@isro.gov.in", city: "Ahmedabad", state: "Gujarat", industry: "Aerospace" },
    { company: "Bajaj Auto Ltd", contactPerson: "Kiran Deshmukh", mobile: "+91 99000 67890", email: "kiran.d@bajajauto.com", city: "Pune", state: "Maharashtra", industry: "Automotive" },
    { company: "Jindal Steel & Power", contactPerson: "Manoj Agarwal", mobile: "+91 98990 78901", email: "manoj.a@jindalsteel.com", city: "Raigarh", state: "Chhattisgarh", industry: "Steel" },
    { company: "Godrej & Boyce", contactPerson: "Farhan Sheikh", mobile: "+91 98880 89012", email: "farhan.s@godrej.com", city: "Mumbai", state: "Maharashtra", industry: "Manufacturing" },
    { company: "Ashok Leyland", contactPerson: "Deepak Nair", mobile: "+91 98760 90123", email: "deepak.n@ashokleyland.com", city: "Chennai", state: "Tamil Nadu", industry: "Automotive" },
    { company: "TVS Motor Company", contactPerson: "Lakshmi Venkat", mobile: "+91 98650 01234", email: "lakshmi.v@tvsmotor.com", city: "Chennai", state: "Tamil Nadu", industry: "Automotive" },
    { company: "Ultratech Cement", contactPerson: "Prakash More", mobile: "+91 98540 12345", email: "prakash.m@ultratech.com", city: "Nagpur", state: "Maharashtra", industry: "Cement" },
    { company: "HAL - Hindustan Aeronautics", contactPerson: "Group Capt. Rao", mobile: "+91 98430 23456", email: "rao.g@hal-india.com", city: "Bengaluru", state: "Karnataka", industry: "Aerospace" },
  ];

  const customers = await Promise.all(
    customerData.map((c, i) =>
      db.customer.upsert({
        where: { id: `cust-${i + 1}` },
        update: {},
        create: { id: `cust-${i + 1}`, ...c, createdBy: admin.id },
      })
    )
  );
  console.log(`✅ Created ${customers.length} customers`);

  // 4. Create enquiries (varied dates, statuses, executives)
  const sources = ["WEBSITE", "REFERENCE", "EXHIBITION", "COLD_CALL", "EMAIL_CAMPAIGN", "SOCIAL_MEDIA", "TELEMARKETING"];
  const statuses = ["NEW", "QUALIFIED", "HOT", "WARM", "COLD", "LOST", "CONVERTED"];
  const now = new Date();
  const enquiries: any[] = [];

  for (let i = 0; i < 40; i++) {
    const customer = customers[i % customers.length];
    const product = products[i % products.length];
    const exec = execs[i % execs.length];
    const status = statuses[i % statuses.length];
    const daysAgo = Math.floor(Math.random() * 60);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);

    const budget = [50000, 100000, 250000, 500000, 1000000, 2000000][i % 6];
    const converted = status === "CONVERTED";
    const leadScore = Math.floor(Math.random() * 100);
    const nextFollowUp = status !== "CONVERTED" && status !== "LOST"
      ? new Date(now.getTime() + (Math.random() * 7 - 3) * 86400000)
      : null;

    const enq = await db.enquiry.create({
      data: {
        enquiryNumber: `ENQ-2025-${String(1001 + i)}`,
        date,
        source: sources[i % sources.length],
        customerId: customer.id,
        company: customer.company,
        contactPerson: customer.contactPerson,
        mobile: customer.mobile,
        email: customer.email || null,
        productInterested: product.name,
        productId: product.id,
        budget,
        city: customer.city,
        state: customer.state,
        specification: `Looking for ${product.category} for our QC lab. Need installation and training.`,
        remarks: i % 3 === 0 ? "Repeat customer" : "First enquiry",
        assignedTo: exec.id,
        createdBy: i % 2 === 0 ? manager.id : exec.id,
        status,
        leadScore,
        conversionProb: Math.round(leadScore * 0.85 * 10) / 10,
        nextFollowUpDate: nextFollowUp,
        convertedAt: converted ? new Date(date.getTime() + 14 * 86400000) : null,
        orderValue: converted ? budget * 0.9 : null,
        lastFollowUpDate: new Date(date.getTime() + 3 * 86400000),
      },
    });
    enquiries.push(enq);
  }
  console.log(`✅ Created ${enquiries.length} enquiries`);

  // 5. Follow-ups for each enquiry
  for (const enq of enquiries) {
    const followCount = enq.status === "CONVERTED" ? 4 : enq.status === "LOST" ? 2 : Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < followCount; j++) {
      const fDate = new Date(enq.date);
      fDate.setDate(fDate.getDate() + j * 3 + 1);
      if (fDate > now) continue;
      await db.followUp.create({
        data: {
          enquiryId: enq.id,
          date: fDate,
          nextFollowUpDate: j < followCount - 1 ? new Date(fDate.getTime() + 3 * 86400000) : enq.nextFollowUpDate,
          method: ["CALL", "EMAIL", "WHATSAPP", "MEETING"][j % 4],
          status: enq.status === "CONVERTED" ? "CONVERTED" : ["HOT", "WARM", "COLD"][j % 3],
          notes: `Follow-up #${j + 1}: Discussed pricing and specifications. Customer ${["interested", "comparing options", "needs approval", "ready to proceed"][j % 4]}.`,
          outcome: j === followCount - 1 ? (enq.status === "CONVERTED" ? "Order received" : enq.status === "LOST" ? "Lost to competitor" : "Ongoing") : "Scheduled next follow-up",
          completed: fDate < now,
          createdBy: enq.assignedTo,
        },
      });
    }
  }
  console.log(`✅ Created follow-ups`);

  // 6. Quotations for qualified/hot/converted enquiries
  let qNum = 1;
  for (const enq of enquiries) {
    if (["QUALIFIED", "HOT", "WARM", "CONVERTED"].includes(enq.status)) {
      const amount = (enq.budget || 100000) * (0.85 + Math.random() * 0.2);
      await db.quotation.create({
        data: {
          enquiryId: enq.id,
          number: `QT-2025-${String(5001 + qNum)}`,
          date: new Date(enq.date.getTime() + 5 * 86400000),
          amount: Math.round(amount),
          status: enq.status === "CONVERTED" ? "ACCEPTED" : "SENT",
          validUntil: new Date(now.getTime() + 30 * 86400000),
          items: JSON.stringify([{ product: enq.productInterested, qty: 1, price: Math.round(amount) }]),
          notes: "Price inclusive of installation, training, and 1-year warranty. GST extra.",
          approvedBy: enq.status === "CONVERTED" ? manager.id : null,
          approvedAt: enq.status === "CONVERTED" ? new Date(enq.date.getTime() + 10 * 86400000) : null,
          createdBy: enq.assignedTo,
        },
      });
      qNum++;
    }
  }
  console.log(`✅ Created ${qNum - 1} quotations`);

  // 7. Activities
  for (const enq of enquiries.slice(0, 20)) {
    await db.activity.create({
      data: {
        enquiryId: enq.id,
        customerId: enq.customerId,
        userId: enq.assignedTo,
        type: "NOTE",
        content: `Initial enquiry logged for ${enq.productInterested}. Customer appears ${enq.status === "HOT" ? "highly interested" : "evaluating"}.`,
      },
    });
  }

  // 8. Sample audit logs
  await db.auditLog.createMany({
    data: [
      { userId: superAdmin.id, userName: superAdmin.name, action: "LOGIN", entity: "USER", description: "System initialized — MSIH CRM V1.0 seeded by Manoj Dore", ipAddress: "127.0.0.1", userAgent: "seed-script" },
      { userId: admin.id, userName: admin.name, action: "CREATE", entity: "USER", description: `Created ${users.length} user accounts during initial setup`, ipAddress: "127.0.0.1", userAgent: "seed-script" },
      { userId: admin.id, userName: admin.name, action: "CREATE", entity: "PRODUCT", description: `Created ${products.length} products across 11 categories`, ipAddress: "127.0.0.1", userAgent: "seed-script" },
    ],
  });

  // 9. Settings
  await db.setting.upsert({ where: { key: "company_name" }, update: {}, create: { key: "company_name", value: "MetTechnik Pvt. Ltd." } });
  await db.setting.upsert({ where: { key: "company_address" }, update: {}, create: { key: "company_address", value: "Plot No. 24, MIDC Bhosari, Pune - 411026, Maharashtra, India" } });
  await db.setting.upsert({ where: { key: "company_phone" }, update: {}, create: { key: "company_phone", value: "+91 98765 43210" } });
  await db.setting.upsert({ where: { key: "company_gstin" }, update: {}, create: { key: "company_gstin", value: "27AABCM1234L1Z5" } });
  await db.setting.upsert({ where: { key: "currency" }, update: {}, create: { key: "currency", value: "INR" } });
  await db.setting.upsert({ where: { key: "developer" }, update: {}, create: { key: "developer", value: "Manoj Dore" } });
  await db.setting.upsert({ where: { key: "version" }, update: {}, create: { key: "version", value: "V1.0" } });

  console.log("✅ Created settings");

  // ---------- Seed default email templates ----------
  const adminUser = await db.user.findUnique({ where: { email: "superadmin@mettechnik.com" } });
  if (adminUser) {
    const templates = [
      {
        name: "Welcome — New Enquiry Acknowledgement",
        subject: "Thank you for your enquiry to MetTechnik — {{productInterested}}",
        body: `Dear {{contactPerson}},\n\nThank you for your interest in {{productInterested}}. We have received your enquiry and our team will get back to you within 24 hours with detailed information and pricing.\n\nIn the meantime, feel free to reach us at +91 98765 43210 or reply to this email.\n\nBest regards,\n{{senderName}}\nMetTechnik Pvt. Ltd.\nwww.mettechnik.com`,
        category: "WELCOME",
      },
      {
        name: "Follow-Up — After First Call",
        subject: "Following up on your interest in {{productInterested}}",
        body: `Dear {{contactPerson}},\n\nThank you for the recent discussion regarding {{productInterested}} for {{company}}. As promised, I am sharing additional details and a tentative quotation.\n\nPlease review at your convenience and let me know if you need any clarifications or a formal demonstration at your facility.\n\nLooking forward to your response.\n\nBest regards,\n{{senderName}}\nMetTechnik Pvt. Ltd.`,
        category: "FOLLOWUP",
      },
      {
        name: "Quotation Sent",
        subject: "Quotation {{quotationNumber}} from MetTechnik — {{productInterested}}",
        body: `Dear {{contactPerson}},\n\nPlease find attached our quotation {{quotationNumber}} for {{productInterested}}. The quotation is valid for 30 days from the date of issue.\n\nKey highlights:\n- Quality assured ZEISS / industry-grade instruments\n- Comprehensive warranty and after-sales support\n- Calibration and installation included\n\nPlease feel free to reach out for any clarifications.\n\nBest regards,\n{{senderName}}\nMetTechnik Pvt. Ltd.`,
        category: "QUOTATION",
      },
      {
        name: "Reminder — Pending Follow-Up",
        subject: "Gentle reminder — Your enquiry for {{productInterested}}",
        body: `Dear {{contactPerson}},\n\nWe noticed we haven't heard back from you regarding your enquiry for {{productInterested}}. We understand you may be busy, so just a quick reminder that we're here to help with any questions or requirements.\n\nWould you like to schedule a call or demonstration this week?\n\nBest regards,\n{{senderName}}\nMetTechnik Pvt. Ltd.`,
        category: "REMINDER",
      },
      {
        name: "Thank You — Order Received",
        subject: "Thank you for your order — {{company}}",
        body: `Dear {{contactPerson}},\n\nThank you for choosing MetTechnik as your trusted partner for {{productInterested}}. We have received your order and our team will coordinate the delivery and installation as per agreed timeline.\n\nYou will receive periodic updates on the order status. For any queries, please reach out to us at +91 98765 43210.\n\nWe look forward to a long and fruitful association with {{company}}.\n\nBest regards,\n{{senderName}}\nMetTechnik Pvt. Ltd.`,
        category: "THANK_YOU",
      },
    ];
    for (const t of templates) {
      const existing = await db.emailTemplate.findUnique({ where: { name: t.name } });
      if (!existing) {
        const detected = Array.from(new Set((t.body.match(/\{\{(\w+)\}\}/g) || []).map((m: string) => m.slice(2, -2))));
        await db.emailTemplate.create({
          data: {
            name: t.name,
            subject: t.subject,
            body: t.body,
            category: t.category,
            variables: JSON.stringify(detected),
            createdBy: adminUser.id,
          },
        });
      }
    }
    console.log("✅ Created email templates");
  }

  // ---------- Seed sample reminders (WhatsApp/SMS/Email queue) ----------
  const reminderCount = await db.reminderQueue.count();
  if (reminderCount === 0 && adminUser) {
    const exec = await db.user.findUnique({ where: { email: "rohit@mettechnik.com" } });
    const sampleEnquiries = await db.enquiry.findMany({ take: 3, orderBy: { createdAt: "desc" }, include: { customer: true } });
    const now = new Date();
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
    const hoursAhead = (h: number) => new Date(now.getTime() + h * 3600_000);

    const reminders = [
      {
        channel: "WHATSAPP",
        recipient: sampleEnquiries[0]?.mobile || "+919876543210",
        recipientName: sampleEnquiries[0]?.contactPerson || "Test Customer",
        message: `Hello ${sampleEnquiries[0]?.contactPerson || "Customer"}, this is a reminder about your enquiry for ${sampleEnquiries[0]?.productInterested || "our products"}. Shall we schedule a demo this week? — MetTechnik`,
        enquiryId: sampleEnquiries[0]?.id || null,
        customerId: sampleEnquiries[0]?.customerId || null,
        scheduledAt: hoursAgo(2),
        status: "QUEUED" as const,
      },
      {
        channel: "SMS",
        recipient: sampleEnquiries[1]?.mobile || "+919812345678",
        recipientName: sampleEnquiries[1]?.contactPerson || "Customer",
        message: `MetTechnik: Your quotation for ${sampleEnquiries[1]?.productInterested || "instruments"} is ready. Reply YES to proceed. T&C apply.`,
        enquiryId: sampleEnquiries[1]?.id || null,
        customerId: sampleEnquiries[1]?.customerId || null,
        scheduledAt: hoursAhead(1),
        status: "QUEUED" as const,
      },
      {
        channel: "EMAIL",
        recipient: sampleEnquiries[1]?.email || "customer@example.com",
        recipientName: sampleEnquiries[1]?.contactPerson || "Customer",
        message: `Dear ${sampleEnquiries[1]?.contactPerson || "Customer"},\n\nFollowing up on your interest in ${sampleEnquiries[1]?.productInterested || "our products"}. Please find the detailed brochure attached for your reference.\n\nBest regards,\nMetTechnik Team`,
        enquiryId: sampleEnquiries[1]?.id || null,
        customerId: sampleEnquiries[1]?.customerId || null,
        scheduledAt: hoursAgo(24),
        sentAt: hoursAgo(23),
        status: "SENT" as const,
        attemptCount: 1,
      },
      {
        channel: "WHATSAPP",
        recipient: sampleEnquiries[2]?.mobile || "+919900112233",
        recipientName: sampleEnquiries[2]?.contactPerson || "Customer",
        message: `Reminder: Your demo is scheduled tomorrow. Please confirm availability. — MetTechnik`,
        enquiryId: sampleEnquiries[2]?.id || null,
        customerId: sampleEnquiries[2]?.customerId || null,
        scheduledAt: hoursAgo(5),
        status: "FAILED" as const,
        attemptCount: 2,
        errorMessage: "Recipient number not on WhatsApp — delivery failed after 2 attempts",
      },
    ];

    for (const r of reminders) {
      await db.reminderQueue.create({
        data: {
          ...r,
          createdBy: (exec || adminUser).id,
        },
      });
    }
    console.log(`✅ Created ${reminders.length} sample reminders`);
  }

  console.log("\n🎉 MSIH CRM V1.0 seeded successfully!");
  console.log("\n📋 Demo Credentials (password: admin@123):");
  console.log("   superadmin@mettechnik.com — Manoj Dore (Super Admin)");
  console.log("   admin@mettechnik.com — Anil Deshpande (Admin)");
  console.log("   manager@mettechnik.com — Rohit Sharma (Sales Manager)");
  console.log("   rohit@mettechnik.com — Rohit Verma (Sales Executive)");
  console.log("   priya@mettechnik.com — Priya Nair (Sales Executive)");
  console.log("   amit@mettechnik.com — Amit Kulkarni (Sales Executive)");
}

// Run when executed directly via `npx tsx src/lib/seed.ts`
// (not when imported by /api/setup)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
