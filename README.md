# 🏥 ERP Farmacias SIMI - Arquitectura Segura Cloud

## 📖 Descripción del Proyecto
Este repositorio contiene la evolución de la infraestructura para el ERP de la cadena de farmacias SIMI. El objetivo principal es reestructurar el despliegue anterior para mitigar vulnerabilidades, migrando hacia una arquitectura por capas que integra servicios administrados (PaaS) y estrictos mecanismos de control de acceso e identidad (IAM).

Se ha implementado un portal de autenticación con acceso condicional y Autenticación Multifactor (MFA) para proteger tanto la interfaz web como los servicios de administración de la infraestructura.

## 🏗️ Arquitectura y Stack Tecnológico
El proyecto abandona el despliegue monolítico en IaaS en favor de un ecosistema distribuido en AWS:
*   **Frontend (Capa de Presentación):** Servidor Node.js y Express alojado en una instancia Amazon EC2.
*   **Base de Datos (Capa de Datos - PaaS):** PostgreSQL aprovisionado a través de AWS RDS, operando en una subred aislada.
*   **Almacenamiento de Respaldo:** AWS S3 integrado mediante políticas de AWS IAM y Listas de Control de Acceso (ACL) para almacenar respaldos automatizados de la base de datos.
*   **Seguridad y Acceso:** MFA de 2 pasos para la sesión web y MFA de 3 pasos (PAM) para el acceso administrativo vía SSH.

## 📂 Estructura del Repositorio
El trabajo está centralizado en la ruta `simi-erp/` y se divide en las siguientes áreas:

simi-erp/
├── /frontend      # Código fuente Node.js/Express, Dockerfile y lógica MFA
├── /infra         # Scripts de automatización (backups S3) y configuración de despliegue
└── /docs          # Documentación técnica, diagramas de arquitectura y análisis de costos

## 👥 Equipo y Roles

El desarrollo y despliegue de esta solución se dividió operativamente de la siguiente manera:

| Integrante | Rol Asignado | Responsabilidades Principales |
| :--- | :--- | :--- |
| **Kevin** | 💻 **Desarrollo Backend** | Responsable del refactoring del servidor Express, integración de validación por Token JWT y configuración de MFA (2 pasos) para el portal de autenticación. |
| **Ignacio** | ☁️ **Operaciones Cloud** | Responsable de la creación de recursos en AWS (RDS, Bucket S3, EC2), gestión de Security Groups, scripts de respaldo (Cron/pg_dump) y configuración del MFA de 3 pasos para el servicio OpenSSH. |
| **Diego** | 🏛️ **Arquitectura Cloud y Finanzas** | Responsable del diseño de la nueva arquitectura en capas, análisis de riesgos de la iteración anterior, elaboración de la memoria técnica IAM y evaluación financiera Multi-Cloud (Capex/Opex/TCO). |

---

## 🚀 Instrucciones de Despliegue

1. Clonar este repositorio en la instancia EC2 designada.
2. Configurar el archivo `.env` en la raíz de `/frontend` con el *Endpoint* proporcionado por AWS RDS.
3. Ejecutar el orquestador de contenedores para la capa de presentación:
   ```bash
   docker compose -f docker-compose.frontend.yml up -d --build
