const mysql = require('mysql2/promise');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function setupDatabase() {
    console.log("=== FCIRS CLOUD DATABASE SETUP ===");
    console.log("Please enter your Aiven database credentials (the ones you just put in Render):");

    const host = await askQuestion("DB_HOST (e.g. xxx.aivencloud.com): ");
    const user = await askQuestion("DB_USER (usually avnadmin): ");
    const password = await askQuestion("DB_PASSWORD: ");
    const port = await askQuestion("DB_PORT (e.g. 18765): ");
    const database = await askQuestion("DB_NAME (usually defaultdb): ");

    console.log("\nConnecting to the cloud database...");
    
    try {
        const connection = await mysql.createConnection({
            host: host.trim(),
            user: user.trim(),
            password: password.trim(),
            port: port.trim(),
            database: database.trim(),
            ssl: { rejectUnauthorized: false }
        });

        console.log("Connected successfully! Creating tables...\n");

        // 1. Create Users Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('ADMIN', 'FISHERMAN', 'OPERATOR') DEFAULT 'FISHERMAN',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ 'users' table created.");

        // Insert default admin
        await connection.query(`
            INSERT IGNORE INTO users (username, password, role) 
            VALUES ('Admin', '1234', 'ADMIN')
        `);

        // 2. Create Catches Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS catches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fisherman VARCHAR(255) NOT NULL,
                fish_type VARCHAR(255) NOT NULL,
                weight DECIMAL(10,2) NOT NULL,
                price_per_kg DECIMAL(10,2) NOT NULL,
                total_value DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'RECORDED',
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ 'catches' table created.");

        // 3. Create Operational Expenses Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS operational_expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                description VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                category VARCHAR(100) DEFAULT 'General',
                recorded_by VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ 'operational_expenses' table created.");

        // 4. Create Settings Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                prices JSON NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ 'settings' table created.");
        
        // Insert default prices
        const defaultPrices = { "Tuna": 150, "lumayagan": 150, "Big Karaw": 150, "Perit": 150, "Tulingan": 150, "MC": 150 };
        await connection.query('INSERT IGNORE INTO settings (id, prices) VALUES (1, ?)', [JSON.stringify(defaultPrices)]);

        console.log("\n🎉 SUCCESS! All tables have been built in your cloud database.");
        console.log("You can now close this window and log into your Render website!");
        
        await connection.end();
        rl.close();

    } catch (error) {
        console.error("\n❌ ERROR: Failed to connect or create tables.");
        console.error(error.message);
        console.log("Please double-check your credentials and try running this again.");
        rl.close();
    }
}

setupDatabase();
