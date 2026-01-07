const fs = require("fs");
const path = require("path");

class EmailLogger {
  constructor() {
    this.logsDir = path.join(__dirname, "../../logs");
    this.logFile = path.join(this.logsDir, "email-logs.json");
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, JSON.stringify([]));
    }
  }

  logEmail(to, subject, type = "generic", html = "", status = "sent") {
    try {
      const logs = JSON.parse(fs.readFileSync(this.logFile, "utf8") || "[]");
      const logEntry = {
        time: new Date().toISOString(),
        to,
        subject,
        type,
        status,
        html: html || "",
      };

      logs.push(logEntry);
      fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));

      return { success: true };
    } catch (err) {
      console.error("📌 EmailLogger log fail:", err.message);
      return { success: false, error: err.message };
    }
  }

  getLogs() {
    try {
      const content = fs.readFileSync(this.logFile, "utf8");
      return JSON.parse(content || "[]").reverse(); // latest first
    } catch {
      return [];
    }
  }
}

module.exports = new EmailLogger();
