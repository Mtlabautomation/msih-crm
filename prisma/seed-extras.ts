// MSIH CRM V1.0 — Seed extras (email templates + sample reminders)
// Run when the main seed has already populated enquiries but templates/reminders are missing.
// Developer: Manoj Dore — MIT License

import { db } from "../src/lib/db";

async function main() {
  console.log("🌱 Seeding extras (email templates + reminders)...");

  const adminUser = await db.user.findUnique({ where: { email: "superadmin@mettechnik.com" } });
  if (!adminUser) {
    console.error("❌ Super admin not found. Run the main seed first.");
    return;
  }

  // ---------- Email Templates ----------
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

  let tplCreated = 0;
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
      tplCreated++;
    }
  }
  console.log(`✅ Email templates: ${tplCreated} new (total now ${await db.emailTemplate.count()})`);

  // ---------- Sample Reminders ----------
  const reminderCount = await db.reminderQueue.count();
  if (reminderCount > 0) {
    console.log(`ℹ️  Reminders already seeded (${reminderCount}). Skipping.`);
  } else {
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
    console.log(`✅ Reminders: ${reminders.length} created`);
  }

  console.log("\n🎉 Extras seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
