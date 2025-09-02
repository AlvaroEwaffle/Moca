import React, { useState } from 'react';
import { BACKEND_URL } from "@/utils/config";
import { Check, Target, Clock, BookOpen, Brain, Settings, Sparkles, ArrowLeft, ArrowRight, Crown, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

interface Props {
    data: any;
}

const PremiumResult: React.FC<Props> = ({ data }) => {
    const { preview, pro, sessionId } = data;
    const modulos = pro.mapa_servicio.modulos || [];
    const [currentStep, setCurrentStep] = useState(0);
    const moduloActual = modulos[currentStep];
    const [isProductionDialogOpen, setIsProductionDialogOpen] = useState(false);
    const [additionalDetails, setAdditionalDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleProductionRequest = async () => {
        if (!additionalDetails.trim()) {
            toast({
                title: "Error",
                description: "Por favor proporciona detalles adicionales sobre tu solicitud.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const backendUrl = BACKEND_URL;
            if (!backendUrl) throw new Error('VITE_BACKEND_URL is not set');
            
            const response = await fetch(`${backendUrl}/api/sessions/request-production`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    sessionId,
                    additionalDetails: additionalDetails.trim()
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al enviar la solicitud');
            }

            toast({
                title: "¡Solicitud enviada!",
                description: result.message || "Nos pondremos en contacto contigo pronto.",
            });

            setIsProductionDialogOpen(false);
            setAdditionalDetails('');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error al enviar la solicitud';
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500 py-8 px-2">
            <main className="w-full max-w-4xl bg-white bg-opacity-95 rounded-2xl shadow-2xl p-6 md:p-12 flex flex-col items-center">
                {/* Logo */}
                <img src="/logoprimario.png" alt="Ewaffle Logo" className="w-40 object-contain mb-6" />

                {/* Propuesta de valor */}
                <section id="propuesta" className="w-full mb-10">
                    <h1 className="text-4xl md:text-5xl font-bold text-primary mb-2 text-center">
                        ¡Tu curso e-learning está listo! 🚀
                    </h1>
                    <h2 className="text-2xl font-semibold mb-4 text-center text-primary-700">Propuesta de valor del curso</h2>
                    <p className="text-lg text-gray-700 mb-6 text-center whitespace-pre-line">{preview.propuesta_valor}</p>
                </section>

                {/* Instructor */}
                <section className="w-full mb-10">
                    <h3 className="text-2xl font-bold mb-2 text-primary flex items-center gap-2 justify-center">
                        <Crown className="w-7 h-7 text-secondary-500" /> Tu perfil como instructor experto
                    </h3>
                    <p className="text-lg text-text-gray italic text-center">{pro.propuesta_valor_pro.bio}</p>
                </section>

                {/* Course Production Button - Top */}
                <section className="w-full mb-10">
                    <div className="text-center">
                        <Dialog open={isProductionDialogOpen} onOpenChange={setIsProductionDialogOpen}>
                            <DialogTrigger asChild>
                                <Button 
                                    size="lg"
                                    className="bg-gradient-to-r from-secondary-500 to-accent-500 hover:from-secondary-600 hover:to-accent-600 text-white px-8 py-4 text-lg font-bold rounded-xl shadow-xl"
                                >
                                    <Send className="w-5 h-5 mr-2" />
                                    ¿Te gustaría que produjéramos este curso?
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Solicitar Producción del Curso</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="additionalDetails" className="block text-sm font-medium text-gray-700 mb-2">
                                            Cuéntanos más sobre tu proyecto *
                                        </label>
                                        <Textarea
                                            id="additionalDetails"
                                            placeholder="¿Por qué quieres crear este curso? ¿Cuál es tu objetivo principal? ¿Tienes alguna preferencia específica para la producción?"
                                            value={additionalDetails}
                                            onChange={(e) => setAdditionalDetails(e.target.value)}
                                            className="w-full min-h-[120px]"
                                            required
                                        />
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsProductionDialogOpen(false)}
                                            disabled={isSubmitting}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleProductionRequest}
                                            disabled={isSubmitting || !additionalDetails.trim()}
                                        >
                                            {isSubmitting ? "Enviando..." : "Enviar Solicitud"}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </section>

                {/* Infografía Visual */}
                <section id="infografia" className="w-full mb-10">
                    <h3 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2 justify-center">
                        <Sparkles className="w-7 h-7 text-primary-500" /> Mapa visual del curso
                    </h3>
                    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
                        <p className="text-xl font-semibold mb-6 text-gray-900 text-center">
                            {pro.infografia.titulo}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {pro.infografia.secciones?.map((sec: string, idx: number) => (
                                <div
                                    key={idx}
                                    className="bg-primary-light p-6 rounded-lg border-l-4 border-primary shadow-sm"
                                >
                                    <h4 className="text-lg font-bold text-primary mb-2">{sec}</h4>
                                    <p className="text-sm text-text-gray">
                                        {pro.infografia.contenido?.[idx] || 'Descripción pendiente.'}
                                    </p>
                                </div>
                            ))}
                        </div>
                        {pro.infografia.cta && (
                            <div className="mt-8 flex justify-center">
                                <button className="bg-primary text-white font-semibold px-6 py-3 rounded-lg shadow hover:bg-primary-dark transition text-lg">
                                    {pro.infografia.cta}
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Módulos del curso */}
                <section id="modulos" className="w-full mb-10">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-primary mb-8 flex items-center gap-2 justify-center">
                        <BookOpen className="w-8 h-8 text-primary-500" /> Estructura detallada del curso
                    </h2>
                    <div className="flex flex-col items-center">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                transition={{ duration: 0.4 }}
                                className="bg-primary-light rounded-xl p-8 shadow-inner border-l-8 border-primary/60 w-full max-w-2xl"
                            >
                                <h3 className="text-2xl md:text-3xl font-bold text-primary mb-4">{moduloActual?.nombre}</h3>
                                <p className="text-lg md:text-xl italic text-gray-800 mb-6">{moduloActual?.descripcion}</p>
                                <div className="space-y-6">
                                    {/* Objetivo de Aprendizaje */}
                                    <div className="flex items-start gap-3">
                                        <Target className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-primary mb-1">Objetivo de Aprendizaje</h4>
                                            <p className="text-gray-700">{moduloActual?.objetivo_aprendizaje}</p>
                                        </div>
                                    </div>
                                    {/* Duración */}
                                    <div className="flex items-start gap-3">
                                        <Clock className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-primary mb-1">Duración</h4>
                                            <p className="text-gray-700">{moduloActual?.duracion_semanas} semanas</p>
                                        </div>
                                    </div>
                                    {/* Sugerencias de Contenido */}
                                    <div className="flex items-start gap-3">
                                        <BookOpen className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-primary mb-1">Sugerencias de Contenido</h4>
                                            <ul className="list-disc list-inside text-gray-700">
                                                {moduloActual?.sugerencias_contenido?.map((sugerencia: string, i: number) => (
                                                    <li key={i}>{sugerencia}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    {/* Uso de IA */}
                                    <div className="flex items-start gap-3">
                                        <Brain className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-primary mb-1">Uso de IA en este módulo</h4>
                                            <p className="text-gray-700">{moduloActual?.como_usar_ia}</p>
                                        </div>
                                    </div>
                                    {/* Procesos Internos */}
                                    <div className="flex items-start gap-3">
                                        <Settings className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-primary mb-1">Procesos Internos</h4>
                                            <ul className="list-disc list-inside text-gray-700">
                                                {moduloActual?.procesos_internos?.map((proc: string, i: number) => (
                                                    <li key={i}>{proc}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    {/* Tipos de Recurso */}
                                    <div className="flex items-start gap-3">
                                        <Sparkles className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-primary mb-1">Tipos de Recurso</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {moduloActual?.tipos_recurso?.map((recurso: string, i: number) => (
                                                    <span key={i} className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm">
                                                        {recurso}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                        <div className="flex items-center justify-between mt-8 w-full max-w-2xl">
                            <button
                                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition"
                                onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                                disabled={currentStep === 0}
                            >
                                <ArrowLeft className="w-5 h-5 inline-block mr-1" /> Anterior
                            </button>
                            <span className="text-primary font-semibold text-sm md:text-base tracking-wide uppercase">
                                MÓDULO {currentStep + 1} DE {modulos.length}
                            </span>
                            <button
                                className="px-4 py-2 rounded bg-primary hover:bg-primary-dark text-white font-medium transition"
                                onClick={() => setCurrentStep((prev) => Math.min(prev + 1, modulos.length - 1))}
                                disabled={currentStep === modulos.length - 1}
                            >
                                Siguiente <ArrowRight className="w-5 h-5 inline-block ml-1" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Potencia de IA */}
                <section id="potencia" className="w-full mb-10">
                    <div className="w-full bg-gradient-to-r from-secondary-100 to-accent-100 rounded-xl p-6 mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-6 h-6 text-primary-500" />
                            <h3 className="text-xl font-bold text-primary">¿Cómo potenciar tu curso con IA?</h3>
                        </div>
                        <p className="text-lg text-gray-800 leading-relaxed mb-4">{preview.descripcion_potencia_ia}</p>
                        <div className="grid md:grid-cols-2 gap-4">
                            {preview.ideas_IA.map((idea: string, index: number) => (
                                <div key={index} className="bg-primary-light p-4 rounded-lg">
                                    <p className="text-gray-700">{idea}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Prompts */}
                <section id="prompts" className="w-full mb-10">
                    <h3 className="text-2xl font-bold mb-4 text-primary flex items-center gap-2 justify-center">
                        <Brain className="w-7 h-7 text-primary-500" /> Prompts de IA para potenciar el aprendizaje
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                        {Array.isArray(pro.prompt_ejemplo) ? (
                            pro.prompt_ejemplo.map((p: any, index: number) => (
                                <div key={index} className="bg-primary-light p-6 rounded-lg">
                                    <h4 className="font-semibold text-lg mb-2">{p.modulo}</h4>
                                    <pre className="text-sm text-text-gray bg-white p-4 rounded whitespace-pre-wrap">{p.prompt}</pre>
                                </div>
                            ))
                        ) : (
                            <div className="text-text-gray">
                                {typeof pro.prompt_ejemplo === 'string' ? pro.prompt_ejemplo : 'No hay prompts disponibles.'}
                            </div>
                        )}
                    </div>
                </section>

                {/* Checklist */}
                <section id="checklist" className="w-full mb-10">
                    <h3 className="text-2xl font-bold mb-4 text-primary flex items-center gap-2 justify-center">
                        <Check className="w-7 h-7 text-primary-500" /> Checklist de calidad del curso
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        {pro.checklist_servicio.items.map((item: string, index: number) => (
                            <div key={index} className="bg-primary-light p-4 rounded-lg flex items-center gap-3">
                                <Check className="w-5 h-5 text-primary flex-shrink-0" />
                                <span className="text-text-gray">{item}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Landing page 
                <section id="landing" className="w-full mb-4">
                    <h3 className="text-2xl font-bold mb-4 text-primary flex items-center gap-2 justify-center">
                        <Sparkles className="w-7 h-7 text-primary-500" /> Página de venta del curso
                    </h3>
                    <div className="bg-primary-light p-6 rounded-lg">
                        <p className="mb-4"><strong>Propuesta:</strong> {pro.landing_page.contenido.pv_destacada}</p>
                        <p className="mb-4"><strong>Módulos:</strong> {pro.landing_page.contenido.modulos.join(', ')}</p>
                        <p><strong>Testimonio:</strong> {pro.landing_page.contenido.testimonio_destacado}</p>
                    </div>
                </section>*/}

                {/* Course Production Button - Bottom */}
                <section className="w-full mb-10">
                    <div className="text-center">
                        <Dialog open={isProductionDialogOpen} onOpenChange={setIsProductionDialogOpen}>
                            <DialogTrigger asChild>
                                <Button 
                                    size="lg"
                                    className="bg-gradient-to-r from-secondary-500 to-accent-500 hover:from-secondary-600 hover:to-accent-600 text-white px-8 py-4 text-lg font-bold rounded-xl shadow-xl"
                                >
                                    <Send className="w-5 h-5 mr-2" />
                                    ¿Te gustaría que produjéramos este curso?
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Solicitar Producción del Curso</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="additionalDetails" className="block text-sm font-medium text-gray-700 mb-2">
                                            Cuéntanos más sobre tu proyecto *
                                        </label>
                                        <Textarea
                                            id="additionalDetails"
                                            placeholder="¿Por qué quieres crear este curso? ¿Cuál es tu objetivo principal? ¿Tienes alguna preferencia específica para la producción?"
                                            value={additionalDetails}
                                            onChange={(e) => setAdditionalDetails(e.target.value)}
                                            className="w-full min-h-[120px]"
                                            required
                                        />
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsProductionDialogOpen(false)}
                                            disabled={isSubmitting}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleProductionRequest}
                                            disabled={isSubmitting || !additionalDetails.trim()}
                                        >
                                            {isSubmitting ? "Enviando..." : "Enviar Solicitud"}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default PremiumResult; 