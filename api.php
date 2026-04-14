<?php
/**
 * SISTEMA DE REGISTRO Y DISTRIBUCIÓN DE DOCUMENTOS
 * Grupo 01 - Arquitectura de 3 Capas
 * * Controlador (API REST)
 * Este archivo centraliza el manejo de peticiones HTTP (GET/POST) desde el Frontend.
 * Procesa las reglas de negocio e interactúa con la base de datos, retornando
 * respuestas estructuradas en formato JSON.
 */

// Establecer cabecera para respuestas JSON
header('Content-Type: application/json');

// Importar la conexión a la base de datos
require 'conexion.php';

// Capturar la acción solicitada, por defecto cadena vacía
$action = $_GET['action'] ?? '';

switch ($action) {
    
    /**
     * @action get_despachos
     * @description Obtiene la lista completa de despachos para poblar los selectores (combobox).
     */
    case 'get_despachos':
        $sql = "SELECT * FROM despacho";
        $result = mysqli_query($conn, $sql);
        
        $data = [];
        while ($row = mysqli_fetch_assoc($result)) { 
            $data[] = $row; 
        }
        
        echo json_encode($data);
        break;

    /**
     * @action registrar_documento
     * @description Registra un nuevo documento en estado "Pendiente de entrega".
     * Incluye validación para evitar códigos duplicados.
     */
     case 'registrar_documento':
        $codigo    = mysqli_real_escape_string($conn, $_POST['codigo']);
        $tipo      = mysqli_real_escape_string($conn, $_POST['tipo']);
        $fecha     = mysqli_real_escape_string($conn, $_POST['fecha']);
        $remitente = mysqli_real_escape_string($conn, $_POST['remitente']);
        $despacho  = (int)$_POST['despacho'];

        $check = mysqli_query($conn, "SELECT id FROM documento WHERE codigo_unico = '$codigo'");
        if(mysqli_num_rows($check) > 0){
            echo json_encode(["status" => "error", "message" => "El código ya existe."]); exit;
        }

        $sql = "INSERT INTO documento (codigo_unico, tipo_documento, fecha_recepcion, remitente, id_despacho, estado) 
                VALUES ('$codigo', '$tipo', '$fecha', '$remitente', $despacho, 'Pendiente de entrega')";
        
        if (mysqli_query($conn, $sql)) {
            // NUEVO: Agregar el primer paso a la tabla seguimiento
            $id_nuevo_doc = mysqli_insert_id($conn);
            mysqli_query($conn, "INSERT INTO seguimiento (id_documento, estado, descripcion) 
                                 VALUES ($id_nuevo_doc, 'Pendiente de entrega', 'Documento ingresado por Mesa de Partes')");
            
            echo json_encode(["status" => "success", "message" => "Documento registrado con éxito."]);
        }
        break;

    /**
     * @action listar_documentos
     * @description Devuelve la lista de documentos. Permite filtrado por código y/o despacho.
     */
    case 'listar_documentos':
        $busqueda = $_GET['search'] ?? '';
        $despachoFilter = $_GET['despacho'] ?? '';
        
        // Consulta base con JOIN para traer el nombre del despacho
        $sql = "SELECT d.*, des.nombre as nombre_despacho 
                FROM documento d 
                INNER JOIN despacho des ON d.id_despacho = des.id 
                WHERE 1=1";
        
        // Aplicar filtros dinámicos si existen
        if($busqueda) {
            $sql .= " AND d.codigo_unico LIKE '%$busqueda%'";
        }
        if($despachoFilter) {
            $sql .= " AND d.id_despacho = '$despachoFilter'";
        }
        
        $sql .= " ORDER BY d.id DESC"; // Mostrar los más recientes primero

        $result = mysqli_query($conn, $sql);
        $data = [];
        while ($row = mysqli_fetch_assoc($result)) { 
            $data[] = $row; 
        }
        
        echo json_encode($data);
        break;

    /**
     * @action generar_guia
     * @description Agrupa todos los documentos "Pendientes" de un despacho específico,
     * genera un número de guía único y cambia su estado a "Cargo de envío".
     * Utiliza Transacciones (Commit/Rollback) para asegurar la integridad de la base de datos.
     */
     case 'generar_guia':
        $id_despacho = (int)$_POST['id_despacho'];
        $resDocs = mysqli_query($conn, "SELECT id FROM documento WHERE id_despacho = $id_despacho AND estado = 'Pendiente de entrega'");
        
        if(mysqli_num_rows($resDocs) == 0){
            echo json_encode(["status" => "error", "message" => "No hay documentos pendientes."]); exit;
        }

        $num_guia = "GUIA-" . str_pad(rand(1, 99999), 5, "0", STR_PAD_LEFT);
        
        mysqli_begin_transaction($conn);
        try {
            mysqli_query($conn, "INSERT INTO guia_remito (numero_guia, id_despacho, estado) VALUES ('$num_guia', $id_despacho, 'Cargo de envío')");
            $id_guia = mysqli_insert_id($conn);

            while($doc = mysqli_fetch_assoc($resDocs)){
                $id_doc = $doc['id'];
                mysqli_query($conn, "INSERT INTO detalle_guia (id_guia, id_documento) VALUES ($id_guia, $id_doc)");
                mysqli_query($conn, "UPDATE documento SET estado = 'Cargo de envío' WHERE id = $id_doc");
                
                // NUEVO: Agregar a la tabla seguimiento que se asignó a una guía
                mysqli_query($conn, "INSERT INTO seguimiento (id_documento, estado, descripcion) 
                                     VALUES ($id_doc, 'Cargo de envío', 'Asignado a la guía $num_guia para despacho')");
            }
            mysqli_commit($conn);
            echo json_encode(["status" => "success", "message" => "Guía generada."]);
        } catch (Exception $e) {
            mysqli_rollback($conn);
            echo json_encode(["status" => "error", "message" => "Error."]);
        }
        break;

    /**
     * @action actualizar_estado_documento
     * @description Actualiza el estado final de un documento (Entregado o Notificado).
     */
     case 'actualizar_estado_documento':
        $id_doc = (int)$_POST['id_documento'];
        $nuevo_estado = mysqli_real_escape_string($conn, $_POST['nuevo_estado']);
        
        if (mysqli_query($conn, "UPDATE documento SET estado = '$nuevo_estado' WHERE id = $id_doc")) {
            // NUEVO: Registrar el cambio manual en el seguimiento
            mysqli_query($conn, "INSERT INTO seguimiento (id_documento, estado, descripcion) 
                                 VALUES ($id_doc, '$nuevo_estado', 'Actualización manual de estado del envío')");
            
            echo json_encode(["status" => "success", "message" => "Estado actualizado."]);
        }
        break;

        case 'ver_seguimiento':
        $id_doc = (int)$_GET['id_documento'];
        $sql = "SELECT * FROM seguimiento WHERE id_documento = $id_doc ORDER BY fecha_hora ASC";
        $result = mysqli_query($conn, $sql);
        
        $data = [];
        while ($row = mysqli_fetch_assoc($result)) { $data[] = $row; }
        echo json_encode($data);
        break;

        /**
     * @action login
     * @description Verifica las credenciales del usuario en la base de datos.
     */
    case 'login':
        $username = mysqli_real_escape_string($conn, $_POST['username']);
        $password = mysqli_real_escape_string($conn, $_POST['password']);
        
        $sql = "SELECT id, nombre_completo, rol FROM usuario WHERE username = '$username' AND password = '$password'";
        $result = mysqli_query($conn, $sql);
        
        if (mysqli_num_rows($result) > 0) {
            $user = mysqli_fetch_assoc($result);
            echo json_encode(["status" => "success", "user" => $user]);
        } else {
            echo json_encode(["status" => "error", "message" => "Usuario o contraseña incorrectos."]);
        }
        break;

    default:
        echo json_encode(["status" => "error", "message" => "Acción no reconocida."]);
        break;
}
?>