import { ArrowRight, Users, Calendar, MessageSquare, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";

const Landing = () => {
    const navigate = useNavigate();

    return (
        <>
            <Helmet>
                <title>Moca - Instagram DM Agent</title>
                <meta name="description" content="Plataforma integral para psicólogos y psiquiatras. Gestiona pacientes, citas, calendario y facturación en un solo lugar." />
            </Helmet>
            
            <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    {/* Floating dots */}
                    <div className="absolute top-20 left-10 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <div className="absolute top-40 right-20 w-3 h-3 bg-indigo-400 rounded-full animate-bounce"></div>
                    <div className="absolute top-60 left-1/4 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
                    <div className="absolute top-80 right-1/3 w-2 h-2 bg-blue-300 rounded-full animate-pulse"></div>
                    
                    {/* Floating shapes */}
                    <div className="absolute top-32 right-1/4 w-16 h-16 border-2 border-blue-200 rounded-full animate-spin-slow"></div>
                    <div className="absolute top-96 left-1/3 w-12 h-12 bg-indigo-100 rounded-lg transform rotate-45 animate-pulse"></div>
                    
                    {/* Moving lines */}
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent animate-slide-right"></div>
                    <div className="absolute bottom-0 right-0 w-full h-px bg-gradient-to-l from-transparent via-purple-200 to-transparent animate-slide-left"></div>
                </div>

                {/* Main Content */}
                <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
                    {/* Logo and Brand */}
                    <div className="flex flex-col items-center mb-8">
                        <img 
                            src="/logoprimario.png" 
                            alt="Moca Logo" 
                            className="w-20 h-20 md:w-20 md:h-20 object-contain mb-4 animate-fade-in" 
                        />
                    </div>

                    {/* Hero Section */}
                    <div className="w-full max-w-6xl text-center">
                        {/* Main Title */}
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 text-gray-900 animate-slide-up">
                            Gestiona tu práctica de{" "}
                            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                salud mental
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-lg md:text-xl lg:text-2xl text-gray-600 max-w-4xl mx-auto mb-8 leading-relaxed animate-slide-up-delay">
                            Plataforma integral para psicólogos y psiquiatras. 
                            <span className="font-semibold text-gray-800"> Gestiona pacientes, citas, calendario y facturación </span>
                            en un solo lugar con integración completa de Google Calendar y WhatsApp.
                        </p>

                        {/* CTA Button */}
                        <div className="mb-8 animate-fade-in-delay flex justify-center">
                            <Button
                                onClick={() => navigate('/login')}
                                size="lg"
                                className="w-full max-w-md py-6 text-xl font-bold rounded-2xl shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0 text-white flex items-center justify-center gap-3 transform hover:scale-105 transition-all duration-300"
                            >
                                Comenzar ahora <ArrowRight className="w-6 h-6" />
                            </Button>
                        </div>

                        {/* Social Proof */}
                        <div className="flex flex-col items-center space-y-4 animate-fade-in-delay-2">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Users className="w-5 h-5 text-blue-500" />
                                <span className="font-medium">+50 empresas confían en Moca</span>
                            </div>
                            
                            {/* Trust badges */}
                            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-green-500" />
                                    HIPAA Compliant
                                </span>
                                <span className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-yellow-500" />
                                    Setup en 5 minutos
                                </span>
                                <span className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-blue-500" />
                                    WhatsApp integrado
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Feature Highlights */}
                    <div className="mt-16 w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8 px-4 animate-slide-up-delay-3">
                        <div className="text-center p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-8 h-8 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">Gestión de Citas</h3>
                            <p className="text-gray-600">Sincronización automática con Google Calendar y recordatorios por WhatsApp</p>
                        </div>

                        <div className="text-center p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">Gestión de Pacientes</h3>
                            <p className="text-gray-600">Base de datos completa con historial médico y preferencias de comunicación</p>
                        </div>

                        <div className="text-center p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-8 h-8 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">Comunicación Automática</h3>
                            <p className="text-gray-600">Enlaces personalizados de WhatsApp y recordatorios automáticos</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Landing;
