import { ArrowRight, Users, MessageSquare, Shield, Zap, Instagram, Bot, Send, CheckCircle, Star, Clock, Target, TrendingUp, DollarSign, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useState } from "react";

const Landing = () => {
    const navigate = useNavigate();
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const faqs = [
        {
            question: "¿Cuánto tiempo toma configurar Moca?",
            answer: "Solo 5 minutos. Conectas tu cuenta de Instagram Business, personalizas las respuestas y listo. No necesitas conocimientos técnicos."
        },
        {
            question: "¿Moca puede manejar múltiples cuentas de Instagram?",
            answer: "Sí, Moca está diseñado para manejar múltiples cuentas de Instagram Business simultáneamente, cada una con sus propias configuraciones personalizadas."
        },
        {
            question: "¿Qué pasa si no estoy satisfecho?",
            answer: "Te devolvemos el 100% de tu dinero si en 30 días no cumple tus expectativas. Sin preguntas, sin complicaciones."
        },
        {
            question: "¿Moca respeta los límites de Instagram?",
            answer: "Absolutamente. Moca está diseñado para cumplir con todas las políticas de Instagram y respeta los límites de la API para mantener tu cuenta segura."
        },
        {
            question: "¿Puedo personalizar las respuestas de Moca?",
            answer: "Sí, puedes personalizar completamente las respuestas, el tono, las instrucciones específicas y hasta desactivar la IA para conversaciones específicas."
        }
    ];

    return (
        <>
            <Helmet>
                <title>Moca - Convierte Instagram en tu Máquina de Ventas Automática</title>
                <meta name="description" content="Agente inteligente de Instagram que responde automáticamente, convierte seguidores en clientes y gestiona conversaciones 24/7. Setup en 5 minutos. Garantía 30 días." />
            </Helmet>
            
            {/* Hero Section */}
            <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-50 via-pink-50 to-purple-50">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    {/* Floating dots */}
                    <div className="absolute top-20 left-10 w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
                    <div className="absolute top-40 right-20 w-3 h-3 bg-pink-400 rounded-full animate-bounce"></div>
                    <div className="absolute top-60 left-1/4 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
                    <div className="absolute top-80 right-1/3 w-2 h-2 bg-violet-300 rounded-full animate-pulse"></div>
                    <div className="absolute top-32 left-1/2 w-1 h-1 bg-pink-300 rounded-full animate-pulse"></div>
                    <div className="absolute top-64 right-10 w-2 h-2 bg-purple-300 rounded-full animate-bounce"></div>
                    
                    {/* Floating shapes */}
                    <div className="absolute top-32 right-1/4 w-16 h-16 border-2 border-violet-200 rounded-full animate-spin-slow"></div>
                    <div className="absolute top-96 left-1/3 w-12 h-12 bg-pink-100 rounded-lg transform rotate-45 animate-pulse"></div>
                    <div className="absolute top-48 right-1/3 w-8 h-8 bg-violet-100 rounded-full animate-bounce"></div>
                    
                    {/* Moving lines */}
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-violet-200 to-transparent animate-slide-right"></div>
                    <div className="absolute bottom-0 right-0 w-full h-px bg-gradient-to-l from-transparent via-pink-200 to-transparent animate-slide-left"></div>
                </div>

                {/* Main Content */}
                <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
                    {/* Logo and Brand */}
                    <div className="flex flex-col items-center mb-8">
                        <img 
                            src="/logoprimario.png" 
                            alt="Moca Logo" 
                            className="w-20 h-20 md:w-24 md:h-24 object-contain mb-4 animate-fade-in" 
                        />
                    </div>

                    {/* Hero Section */}
                    <div className="w-full max-w-6xl text-center">
                        {/* Main Title - Benefit-focused */}
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 text-gray-900 animate-slide-up">
                            Convierte Instagram en tu{" "}
                            <span className="bg-gradient-to-r from-violet-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
                                Máquina de Ventas
                            </span>
                        </h1>

                        {/* Subtitle - How + Benefit */}
                        <p className="text-lg md:text-xl lg:text-2xl text-gray-600 max-w-4xl mx-auto mb-8 leading-relaxed animate-slide-up-delay">
                            Agente inteligente que responde automáticamente a mensajes de Instagram, 
                            <span className="font-semibold text-gray-800"> convierte seguidores en clientes 24/7 </span>
                            y nunca pierde una oportunidad de venta.
                        </p>

                        {/* CTA Button */}
                        <div className="mb-8 animate-fade-in-delay flex justify-center">
                            <Button
                                onClick={() => navigate('/login')}
                                size="lg"
                                className="w-full max-w-md py-6 text-xl font-bold rounded-2xl shadow-2xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 border-0 text-white flex items-center justify-center gap-3 transform hover:scale-105 transition-all duration-300"
                            >
                                Comenzar Gratis Ahora <ArrowRight className="w-6 h-6" />
                            </Button>
                        </div>

                        {/* Social Proof */}
                        <div className="flex flex-col items-center space-y-4 animate-fade-in-delay-2">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Users className="w-5 h-5 text-violet-500" />
                                <span className="font-medium">+500 empresas ya automatizaron sus ventas</span>
                            </div>
                            
                            {/* Trust badges */}
                            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-green-500" />
                                    Garantía 30 días
                                </span>
                                <span className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-yellow-500" />
                                    Setup en 5 minutos
                                </span>
                                <span className="flex items-center gap-2">
                                    <Instagram className="w-4 h-4 text-pink-500" />
                                    Sin tarjeta de crédito
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Key Benefits Section */}
            <div className="py-20 bg-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            ¿Por qué Moca es la mejor opción?
                        </h2>
                        <p className="text-xl text-gray-600">
                            Resultados comprobados que transforman tu Instagram
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="flex items-start space-x-4 p-6 rounded-xl bg-gradient-to-br from-violet-50 to-pink-50">
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center">
                                    <TrendingUp className="w-6 h-6 text-violet-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">+300% más conversiones</h3>
                                <p className="text-gray-600">Convierte seguidores en clientes automáticamente con respuestas inteligentes</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4 p-6 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50">
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-pink-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Respuesta en segundos</h3>
                                <p className="text-gray-600">Nunca pierdas una venta por tardar en responder. Moca responde al instante</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4 p-6 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50">
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">ROI comprobado</h3>
                                <p className="text-gray-600">Recupera tu inversión en la primera semana con ventas automatizadas</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4 p-6 rounded-xl bg-gradient-to-br from-violet-50 to-pink-50">
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center">
                                    <Target className="w-6 h-6 text-violet-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Califica leads automáticamente</h3>
                                <p className="text-gray-600">Identifica clientes potenciales y enfócate en los que realmente van a comprar</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4 p-6 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50">
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                                    <Bot className="w-6 h-6 text-pink-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Trabaja 24/7 sin descanso</h3>
                                <p className="text-gray-600">Moca nunca duerme, nunca se cansa y siempre está listo para vender</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4 p-6 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50">
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">100% seguro y confiable</h3>
                                <p className="text-gray-600">Cumple con todas las políticas de Instagram y mantiene tu cuenta protegida</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Social Proof Section */}
            <div className="py-20 bg-gradient-to-br from-violet-50 to-pink-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Lo que dicen nuestros clientes
                        </h2>
                        <p className="text-xl text-gray-600">
                            Resultados reales de empresas reales
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="bg-white p-8 rounded-2xl shadow-lg">
                            <div className="flex items-center mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                                ))}
                            </div>
                            <p className="text-gray-600 mb-4">
                                "Moca triplicó nuestras ventas por Instagram en solo 2 semanas. Es increíble cómo responde automáticamente y convierte seguidores en clientes."
                            </p>
                            <div className="flex items-center">
                                <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mr-4">
                                    <span className="text-violet-600 font-bold">MC</span>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">María Carmen</p>
                                    <p className="text-sm text-gray-500">CEO, Boutique Online</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-2xl shadow-lg">
                            <div className="flex items-center mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                                ))}
                            </div>
                            <p className="text-gray-600 mb-4">
                                "Antes perdía 80% de mis leads por no responder rápido. Ahora Moca responde en segundos y nunca pierdo una venta."
                            </p>
                            <div className="flex items-center">
                                <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mr-4">
                                    <span className="text-pink-600 font-bold">JL</span>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">Juan López</p>
                                    <p className="text-sm text-gray-500">Fundador, Consultoría Digital</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-2xl shadow-lg">
                            <div className="flex items-center mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                                ))}
                            </div>
                            <p className="text-gray-600 mb-4">
                                "Setup en 5 minutos y funcionando perfecto. Moca maneja 3 cuentas de Instagram y genera leads todos los días automáticamente."
                            </p>
                            <div className="flex items-center">
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                                    <span className="text-purple-600 font-bold">AS</span>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">Ana Sofía</p>
                                    <p className="text-sm text-gray-500">Marketing Manager, Agencia</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* How It Works Section */}
            <div className="py-20 bg-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Cómo funciona Moca
                        </h2>
                        <p className="text-xl text-gray-600">
                            En solo 3 pasos tendrás tu Instagram automatizado
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-gradient-to-r from-violet-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="text-2xl font-bold text-white">1</span>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-4">Conecta tu Instagram</h3>
                            <p className="text-gray-600">
                                Vincula tu cuenta de Instagram Business en segundos. No necesitas conocimientos técnicos.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="text-2xl font-bold text-white">2</span>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-4">Personaliza respuestas</h3>
                            <p className="text-gray-600">
                                Configura el tono, estilo y respuestas específicas para tu marca. Moca aprende de tu negocio.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-violet-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="text-2xl font-bold text-white">3</span>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-4">¡Listo! Vende automáticamente</h3>
                            <p className="text-gray-600">
                                Moca responde automáticamente, califica leads y convierte seguidores en clientes 24/7.
                            </p>
                        </div>
                    </div>

                    <div className="text-center mt-12">
                        <Button
                            onClick={() => navigate('/login')}
                            size="lg"
                            className="px-8 py-4 text-lg font-bold rounded-2xl shadow-2xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 border-0 text-white flex items-center justify-center gap-3 transform hover:scale-105 transition-all duration-300 mx-auto"
                        >
                            Comenzar Ahora <ArrowRight className="w-6 h-6" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Offer Section */}
            <div className="py-20 bg-gradient-to-br from-violet-600 to-pink-600">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Oferta Especial de Lanzamiento
                    </h2>
                    <p className="text-xl text-violet-100 mb-8">
                        Prueba Moca GRATIS por 14 días. Sin tarjeta de crédito, sin compromiso.
                    </p>

                    <div className="bg-white rounded-2xl p-8 shadow-2xl">
                        <div className="mb-6">
                            <span className="text-4xl font-bold text-gray-900">$0</span>
                            <span className="text-xl text-gray-600 ml-2">primeros 14 días</span>
                        </div>
                        
                        <div className="space-y-4 mb-8">
                            <div className="flex items-center justify-center space-x-3">
                                <CheckCircle className="w-6 h-6 text-green-500" />
                                <span className="text-gray-700">Acceso completo a todas las funciones</span>
                            </div>
                            <div className="flex items-center justify-center space-x-3">
                                <CheckCircle className="w-6 h-6 text-green-500" />
                                <span className="text-gray-700">Soporte prioritario incluido</span>
                            </div>
                            <div className="flex items-center justify-center space-x-3">
                                <CheckCircle className="w-6 h-6 text-green-500" />
                                <span className="text-gray-700">Configuración personalizada gratis</span>
                            </div>
                            <div className="flex items-center justify-center space-x-3">
                                <CheckCircle className="w-6 h-6 text-green-500" />
                                <span className="text-gray-700">Garantía de devolución 30 días</span>
                            </div>
                        </div>

                        <Button
                            onClick={() => navigate('/login')}
                            size="lg"
                            className="w-full py-6 text-xl font-bold rounded-2xl shadow-2xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 border-0 text-white flex items-center justify-center gap-3 transform hover:scale-105 transition-all duration-300"
                        >
                            Comenzar Prueba Gratis <ArrowRight className="w-6 h-6" />
                        </Button>

                        <p className="text-sm text-gray-500 mt-4">
                            No pedimos tarjeta de crédito • Cancela cuando quieras • Garantía 30 días
                        </p>
                    </div>
                </div>
            </div>

            {/* Guarantee Section */}
            <div className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-12">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Shield className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Garantía de Devolución 30 Días
                        </h2>
                        <p className="text-xl text-gray-600 mb-6">
                            Estamos tan seguros de que Moca transformará tu Instagram que te devolvemos el 100% de tu dinero si no estás satisfecho.
                        </p>
                        <div className="bg-white rounded-xl p-6 shadow-lg">
                            <p className="text-lg font-semibold text-gray-800 mb-2">
                                "Si en 30 días no aumentas tus ventas por Instagram, te devolvemos tu dinero. Así de seguro estamos."
                            </p>
                            <p className="text-gray-600">
                                Sin preguntas, sin complicaciones, sin letra pequeña.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="py-20 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Preguntas Frecuentes
                        </h2>
                        <p className="text-xl text-gray-600">
                            Resolvemos tus dudas más comunes
                        </p>
                    </div>

                    <div className="space-y-4">
                        {faqs.map((faq, index) => (
                            <div key={index} className="bg-white rounded-xl shadow-lg">
                                <button
                                    className="w-full px-6 py-4 text-left flex items-center justify-between focus:outline-none"
                                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                >
                                    <span className="text-lg font-semibold text-gray-900">{faq.question}</span>
                                    {openFaq === index ? (
                                        <X className="w-5 h-5 text-gray-500" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-500" />
                                    )}
                                </button>
                                {openFaq === index && (
                                    <div className="px-6 pb-4">
                                        <p className="text-gray-600">{faq.answer}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Final CTA Section */}
            <div className="py-20 bg-gradient-to-br from-violet-600 to-pink-600">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        ¿Listo para transformar tu Instagram?
                    </h2>
                    <p className="text-xl text-violet-100 mb-8">
                        Únete a +500 empresas que ya automatizaron sus ventas con Moca
                    </p>

                    <Button
                        onClick={() => navigate('/login')}
                        size="lg"
                        className="px-12 py-6 text-xl font-bold rounded-2xl shadow-2xl bg-white text-violet-600 hover:bg-violet-50 flex items-center justify-center gap-3 transform hover:scale-105 transition-all duration-300 mx-auto"
                    >
                        Comenzar Gratis Ahora <ArrowRight className="w-6 h-6" />
                    </Button>

                    <p className="text-violet-200 mt-6">
                        Prueba gratis • Sin tarjeta de crédito • Garantía 30 días
                    </p>
                </div>
            </div>

            {/* Minimal Footer */}
            <footer className="py-8 bg-gray-900">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="flex items-center space-x-4 mb-4 md:mb-0">
                            <img src="/logoprimario.png" alt="Moca Logo" className="w-8 h-8" />
                            <span className="text-white font-semibold">Moca</span>
                        </div>
                        <div className="flex space-x-6 text-sm text-gray-400">
                            <a href="/privacy" className="hover:text-white transition-colors">Privacidad</a>
                            <a href="/terms" className="hover:text-white transition-colors">Términos</a>
                            <a href="/contact" className="hover:text-white transition-colors">Contacto</a>
                        </div>
                    </div>
                </div>
            </footer>
        </>
    );
};

export default Landing;
