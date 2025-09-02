import { useParams } from 'react-router-dom';
import { BACKEND_URL } from "@/utils/config";
import { useEffect, useState } from 'react';
import PremiumResult from './PremiumResult';

// Mock premium data example
const mockPremiumData = {
  sessionId: 'demo',
  preview: {
    propuesta_valor: "🔍 Este es un ejemplo de propuesta de valor para un curso e-learning de yoga para adultos mayores:\n\nAyudo a adultos mayores a reconectarse con su cuerpo y emociones a través de un curso online de yoga adaptado, mejorando su movilidad, bienestar y autoestima desde la comodidad de su hogar.",
    descripcion_potencia_ia: "La IA puede potenciar tu curso e-learning personalizando el contenido según el nivel y necesidades de cada estudiante, generando ejercicios adaptados y proporcionando feedback automático. Por ejemplo, podrías usar ChatGPT para crear rutinas personalizadas o responder dudas frecuentes de forma empática.",
    ideas_IA: [
      "✔️ Generar rutinas personalizadas según el nivel del estudiante",
      "✔️ Crear ejercicios adaptados con IA",
      "✔️ Proporcionar feedback automático sobre la postura",
      "✔️ Generar contenido educativo complementario",
      "✔️ Personalizar el ritmo de aprendizaje",
      "✔️ Crear evaluaciones adaptativas",
      "✔️ Ofrecer soporte 24/7 con chatbots"
    ]
  },
  pro: {
    propuesta_valor_pro: {
      bio: "Instructor certificado de yoga especializado en adultos mayores. Más de 10 años ayudando a estudiantes a mejorar su calidad de vida a través del yoga adaptado.",
      imagen_alt: "Imagen de una clase online de yoga con adultos mayores participando activamente"
    },
    mapa_servicio: {
      titulo_servicio: "Yoga Consciente para Adultos Mayores - Curso Online",
      modulos: [
        {
          nombre: "Módulo 1: Fundamentos y Bienvenida",
          descripcion: "Introducción al curso y conceptos básicos del yoga adaptado para adultos mayores.",
          objetivo_aprendizaje: "Comprender los principios básicos del yoga y cómo adaptarlos a las necesidades de adultos mayores.",
          sugerencias_contenido: [
            "Video de bienvenida y presentación del curso",
            "Guía de conceptos básicos en PDF",
            "Ejercicio de autoevaluación inicial",
            "Foro de presentación de estudiantes"
          ],
          como_usar_ia: "Usar IA para generar ejercicios de autoevaluación personalizados y moderar el foro de presentación.",
          procesos_internos: "Preparar materiales de bienvenida, configurar el foro, revisar perfiles de estudiantes.",
          tipos_recurso: ["Video", "PDF", "Quiz", "Foro"],
          duracion_semanas: 2
        },
        {
          nombre: "Módulo 2: Posturas Básicas Adaptadas",
          descripcion: "Aprende las posturas fundamentales del yoga adaptadas para adultos mayores.",
          objetivo_aprendizaje: "Dominar las posturas básicas de yoga de forma segura y adaptada.",
          sugerencias_contenido: [
            "Videos tutoriales de posturas básicas",
            "Guía de modificaciones y adaptaciones",
            "Ejercicios prácticos con feedback",
            "Sesión de preguntas y respuestas"
          ],
          como_usar_ia: "Implementar sistema de feedback automático sobre posturas y generar ejercicios personalizados.",
          procesos_internos: "Grabar videos, crear guías, configurar sistema de feedback.",
          tipos_recurso: ["Video", "PDF", "Ejercicios", "Q&A"],
          duracion_semanas: 3
        },
        {
          nombre: "Módulo 3: Práctica Integrada",
          descripcion: "Integra todo lo aprendido en rutinas completas y personalizadas.",
          objetivo_aprendizaje: "Crear y ejecutar rutinas de yoga adaptadas a necesidades específicas.",
          sugerencias_contenido: [
            "Rutinas completas en video",
            "Plantillas de rutinas personalizables",
            "Proyecto final de rutina personal",
            "Sesión de práctica grupal"
          ],
          como_usar_ia: "Usar IA para generar rutinas personalizadas y analizar el progreso de los estudiantes.",
          procesos_internos: "Preparar rutinas, crear plantillas, revisar proyectos finales.",
          tipos_recurso: ["Video", "Plantillas", "Proyecto", "Sesión Live"],
          duracion_semanas: 3
        },
        {
          nombre: "Módulo 4: Evaluación y Certificación",
          descripcion: "Evaluación final y certificación del curso.",
          objetivo_aprendizaje: "Demostrar el dominio de los conceptos y prácticas aprendidas.",
          sugerencias_contenido: [
            "Evaluación práctica final",
            "Cuestionario de conocimientos",
            "Certificado de participación",
            "Sesión de cierre y próximos pasos"
          ],
          como_usar_ia: "Implementar evaluación adaptativa y generar certificados personalizados.",
          procesos_internos: "Preparar evaluaciones, configurar sistema de certificados, organizar sesión de cierre.",
          tipos_recurso: ["Evaluación", "Quiz", "Certificado", "Sesión Live"],
          duracion_semanas: 2
        }
      ]
    },
    prompt_ejemplo: [
      {
        modulo: "Módulo 1: Fundamentos",
        prompt: "Actúa como un instructor de yoga especializado en adultos mayores. Crea una lista de preguntas para evaluar el nivel inicial, condición física y objetivos de un nuevo estudiante. Sé claro, amable y no invasivo."
      },
      {
        modulo: "Módulo 2: Posturas",
        prompt: "Genera una rutina de yoga adaptada para un estudiante de 70 años con movilidad reducida en las rodillas. Incluye modificaciones y alternativas seguras."
      },
      {
        modulo: "Módulo 3: Práctica",
        prompt: "Crea una rutina semanal de yoga suave que combine respiración, posturas básicas y relajación, adaptada para adultos mayores."
      },
      {
        modulo: "Módulo 4: Evaluación",
        prompt: "Diseña una evaluación práctica que permita a los estudiantes demostrar su comprensión y aplicación de los conceptos aprendidos."
      }
    ],
    infografia: {
      titulo: "Mapa del Curso: Yoga Consciente para Adultos Mayores",
      secciones: ["Fundamentos", "Posturas Básicas", "Práctica Integrada", "Certificación"],
      contenido: [
        "Evaluación inicial y conceptos básicos del yoga adaptado",
        "Aprendizaje de posturas fundamentales con modificaciones",
        "Integración de conocimientos en rutinas personalizadas",
        "Evaluación final y certificación del curso"
      ],
      cta: "Comienza tu viaje hacia el bienestar"
    },
    checklist_servicio: {
      titulo: "Checklist de Calidad del Curso",
      items: [
        "¿Cada módulo tiene objetivos de aprendizaje claros?",
        "¿Los contenidos son accesibles y fáciles de seguir?",
        "¿Hay variedad de recursos (video, texto, ejercicios)?",
        "¿Se incluyen actividades prácticas y evaluaciones?",
        "¿El feedback y soporte están garantizados?",
        "¿La duración de cada módulo es apropiada?"
      ],
      formato: "Editable en Notion y Google Docs"
    },
    landing_page: {
      url: "https://ewaffle.com/yoga-adultos-mayores",
      contenido: {
        pv_destacada: "Aprende yoga adaptado desde la comodidad de tu hogar. Mejora tu movilidad, bienestar y autoestima con clases personalizadas para adultos mayores.",
        modulos: ["Fundamentos", "Posturas Básicas", "Práctica Integrada", "Certificación"],
        testimonio_destacado: "'Este curso cambió mi forma de moverme y me dio más confianza en mi día a día.'",
        cta: "Inscríbete ahora y comienza tu viaje hacia el bienestar"
      }
    }
  },
  isPaid: true
};

const PremiumResultLoader = () => {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    if (sessionId === 'mock') {
      setData({ ...mockPremiumData, sessionId });
      setLoading(false);
      return;
    }
    const backendUrl = BACKEND_URL;
    if (!backendUrl) throw new Error('VITE_BACKEND_URL is not set');
    fetch(`${backendUrl}/api/sessions/${sessionId}/premium`)
      .then(res => {
        if (!res.ok) throw new Error('No se pudo cargar el contenido premium del curso');
        return res.json();
      })
      .then(data => setData({ ...data, sessionId }))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-lg">Generando la estructura detallada de tu curso... esto puede tomar unos minutos</div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center text-red-600">{error || 'Error al cargar los datos del curso.'}</div>;

  return <PremiumResult data={data} />;
};

export default PremiumResultLoader; 