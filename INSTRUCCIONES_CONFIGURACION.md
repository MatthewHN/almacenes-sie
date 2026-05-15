# Instrucciones de Configuración y Despliegue

## 1. Configuración de Base de Datos (MongoDB Atlas)
1. Ve a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) y crea una cuenta o inicia sesión.
2. Crea un nuevo cluster (la capa gratuita es perfecta para esto).
3. En la sección "Database Access", crea un nuevo usuario de base de datos con contraseña. Guarda estas credenciales.
4. En "Network Access", añade la dirección IP `0.0.0.0/0` para permitir conexiones desde Vercel (o tu IP actual si solo pruebas localmente).
5. Ve a "Database", haz clic en "Connect", selecciona "Drivers" y copia la cadena de conexión (Connection String).
6. Reemplaza `<password>` en la cadena por la contraseña de tu usuario de base de datos.
7. Crea un archivo `.env.local` en la raíz del proyecto y añade:
   `MONGODB_URI=tu_cadena_de_conexion_aqui`

## 2. Configuración de Modelos IA (NVIDIA NIM / OpenAI Compatible API)
El profesor indicó usar [build.nvidia.com](https://build.nvidia.com/models). Nvidia expone una API compatible con OpenAI para sus modelos.
1. Crea una cuenta en NVIDIA (NVIDIA Developer/NGC).
2. Genera una API Key desde el catálogo de modelos NIM.
3. Añade la API key a tu archivo `.env.local`:
   `NVIDIA_API_KEY=tu_api_key_aqui`

## 3. Ejecución Local
1. Ejecuta `npm install` (si no lo has hecho).
2. Añade los scripts en package.json: `"dev": "next dev", "build": "next build", "start": "next start"`
3. Ejecuta `npm run dev`.

## 4. Despliegue en Vercel
1. Sube este proyecto a un repositorio de GitHub (o GitLab/Bitbucket).
2. Ve a [Vercel](https://vercel.com/) e inicia sesión con GitHub.
3. Importa el repositorio.
4. En "Environment Variables", añade:
   - `MONGODB_URI` y tu cadena.
   - `NVIDIA_API_KEY` y tu valor.
5. Haz clic en Deploy.
