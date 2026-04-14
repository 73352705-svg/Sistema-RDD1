<?php
$host = "localhost";
$user = "root";
$pass = ""; // Cambia si tu BD tiene contraseña
$db   = "sistema_tramite";

$conn = mysqli_connect($host, $user, $pass, $db);

if (!$conn) {
    die(json_encode(["status" => "error", "message" => "Error de conexión: " . mysqli_connect_error()]));
}

mysqli_set_charset($conn, "utf8");
?>