# SOP: Ciclo de Vida del Contenido

1. **Auditoría:** Ejecutar `execution/scraper.py` con la URL del cliente.
2. **Generación:** - Generar Caption usando `generator.py` (Contexto: Brand Identity).
   - Generar Imagen usando Nano Banana (Contexto: Visual Strategy).
3. **Persistencia:** Guardar en DB con estado `PENDING_REVIEW`.
4. **Notificación:** Avisar al usuario para revisión en el Dashboard.
5. **Publicación:** Al recibir `APPROVED`, disparar el API de Instagram/UploadPost.