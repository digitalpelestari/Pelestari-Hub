import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Kosongkan jika pakai XAMPP standar
  database: 'db_pelestari'
});