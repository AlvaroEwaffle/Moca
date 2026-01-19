import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Settings,
  LogOut,
  Menu,
  Bell,
  Search,
  ChevronDown,
  Home,
  MessageSquare,
  Instagram,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Mail,
  Settings2,
  Activity,
  MessageCircle
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BACKEND_URL } from "@/utils/config";
import { useToast } from "@/hooks/use-toast";

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [notifications, setNotifications] = useState(3);
  const [instagramAccount, setInstagramAccount] = useState<any>(null);
  const [isActiveLoading, setIsActiveLoading] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('userData');
    if (user) {
      setUserData(JSON.parse(user));
    }
    fetchInstagramAccount();
  }, []);

  const fetchInstagramAccount = async () => {
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/accounts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?.accounts && data.data.accounts.length > 0) {
          setInstagramAccount(data.data.accounts[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching Instagram account:', error);
    }
  };

  const handleToggleAccountActive = async (accountId: string, isActive: boolean) => {
    setIsActiveLoading(true);
    try {
      const backendUrl = BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/instagram/accounts/${accountId}/active`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ isActive })
      });

      const data = await response.json();

      if (response.ok) {
        setInstagramAccount((prev: any) => prev ? { ...prev, isActive } : null);
        toast({
          title: isActive ? "Cuenta Activada" : "Cuenta Desactivada",
          description: `La cuenta de Instagram ha sido ${isActive ? 'activada' : 'desactivada'} exitosamente`,
        });
      } else {
        throw new Error(data.error || 'Failed to update account status');
      }
    } catch (error: any) {
      console.error('Error toggling account active:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado de la cuenta",
        variant: "destructive"
      });
      
      // Revert the toggle in UI
      setInstagramAccount((prev: any) => prev ? { ...prev, isActive: !isActive } : null);
    } finally {
      setIsActiveLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    navigate('/');
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/app/dashboard',
      icon: Home,
      current: location.pathname === '/app/dashboard'
    },
    {
      name: 'Analytics',
      href: '/app/analytics',
      icon: BarChart3,
      current: location.pathname.startsWith('/app/analytics')
    },
    {
      name: 'Instagram',
      href: '/app/instagram',
      icon: Instagram,
      current: location.pathname.startsWith('/app/instagram') || location.pathname.startsWith('/app/conversations') || location.pathname.startsWith('/app/comments'),
      subItems: [
        {
          name: 'Agent Config',
          href: '/app/instagram',
          icon: Settings2,
          current: location.pathname === '/app/instagram'
        },
        {
          name: 'Conversations',
          href: '/app/conversations',
          icon: MessageSquare,
          current: location.pathname.startsWith('/app/conversations')
        },
        {
          name: 'Comentarios',
          href: '/app/instagram/comments',
          icon: MessageCircle,
          current: location.pathname.startsWith('/app/instagram/comments')
        }
      ]
    },
    {
      name: 'Gmail',
      href: '/app/gmail',
      icon: Mail,
      current: location.pathname.startsWith('/app/gmail')
    }
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!userData) {
    return null; // or loading spinner
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50">
      {/* Mobile menu */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <span className="text-xl font-bold">Moca</span>
            </SheetTitle>
          </SheetHeader>
          
          <nav className="mt-8 space-y-2">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.subItems ? (
                  <Accordion 
                    type="single" 
                    collapsible 
                    className="w-full"
                    defaultValue={item.current ? item.name : undefined}
                  >
                    <AccordionItem value={item.name} className="border-0">
                      <AccordionTrigger
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:no-underline ${
                          item.current
                            ? 'bg-violet-100 text-violet-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="flex-1 text-left">{item.name}</span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="ml-6 space-y-1">
                          {item.subItems.map((subItem) => (
                            <Link
                              key={subItem.name}
                              to={subItem.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                subItem.current
                                  ? 'bg-violet-100 text-violet-700'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <subItem.icon className="w-4 h-4" />
                              <span>{subItem.name}</span>
                            </Link>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : (
              <Link
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  item.current
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
                )}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ${
        isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
      }`}>
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 border-r border-gray-200">
          <div className="flex h-16 shrink-0 items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              {!isSidebarCollapsed && (
                <span className="text-xl font-bold text-gray-900">Moca</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      {item.subItems && !isSidebarCollapsed ? (
                        <Accordion 
                          type="single" 
                          collapsible 
                          className="w-full"
                          defaultValue={item.current ? item.name : undefined}
                        >
                          <AccordionItem value={item.name} className="border-0">
                            <AccordionTrigger
                              className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-colors hover:no-underline ${
                                item.current
                                  ? 'bg-violet-50 text-violet-700'
                                  : 'text-gray-700 hover:text-violet-700 hover:bg-violet-50'
                              }`}
                            >
                              <div className="flex items-center gap-x-3 flex-1">
                                <item.icon className="h-6 w-6 shrink-0" />
                                {item.name}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-1 pb-0">
                              <ul className="ml-8 space-y-1">
                                {item.subItems.map((subItem) => (
                                  <li key={subItem.name}>
                                    <Link
                                      to={subItem.href}
                                      className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-colors ${
                                        subItem.current
                                          ? 'bg-violet-50 text-violet-700'
                                          : 'text-gray-700 hover:text-violet-700 hover:bg-violet-50'
                                      }`}
                                    >
                                      <subItem.icon className="h-5 w-5 shrink-0" />
                                      {subItem.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      ) : isSidebarCollapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              to={item.href}
                              className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-colors justify-center ${
                                item.current
                                  ? 'bg-violet-50 text-violet-700'
                                  : 'text-gray-700 hover:text-violet-700 hover:bg-violet-50'
                              }`}
                            >
                              <item.icon className="h-6 w-6 shrink-0" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="ml-2">
                            <p>{item.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Link
                          to={item.href}
                          className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium transition-colors ${
                            item.current
                              ? 'bg-violet-50 text-violet-700'
                              : 'text-gray-700 hover:text-violet-700 hover:bg-violet-50'
                          }`}
                        >
                          <item.icon className="h-6 w-6 shrink-0" />
                          {item.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
              
              <li className="mt-auto">
                <div className={`flex items-center p-3 rounded-lg bg-gray-50 ${
                  isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                }`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userData.avatar} alt={userData.name} />
                    <AvatarFallback className="bg-violet-100 text-violet-700 text-sm font-medium">
                      {getInitials(userData.name)}
                    </AvatarFallback>
                  </Avatar>
                  {!isSidebarCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {userData.name}
                        </p>
                        {userData.specialization && (
                        <p className="text-xs text-gray-500 truncate">
                            {userData.specialization}
                        </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {instagramAccount && (
                            <>
                              <div className="px-2 py-1.5">
                                <div className="flex items-center justify-between space-x-2">
                                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    <Activity className="h-4 w-4 text-violet-600 flex-shrink-0" />
                                    <Label 
                                      htmlFor="account-active-toggle" 
                                      className="text-sm font-medium cursor-pointer flex-1 truncate"
                                    >
                                      {instagramAccount.accountName || 'Instagram'}
                                    </Label>
                                  </div>
                                  <Switch
                                    id="account-active-toggle"
                                    checked={instagramAccount.isActive}
                                    onCheckedChange={(checked) => {
                                      if (instagramAccount.accountId) {
                                        handleToggleAccountActive(instagramAccount.accountId, checked);
                                      }
                                    }}
                                    disabled={isActiveLoading}
                                    className="flex-shrink-0"
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1 ml-6">
                                  {instagramAccount.isActive ? 'Cuenta activa' : 'Cuenta inactiva'}
                                </p>
                              </div>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem onClick={() => navigate('/configuracion')}>
                            <Settings className="mr-2 h-4 w-4" />
                            Configuración
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Cerrar Sesión
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ${
        isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      }`}>
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center gap-x-4 lg:gap-x-6">
              <div className="relative flex flex-1">
                <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-6 w-6" />
                {notifications > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                    {notifications}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <Outlet />
        </main>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default MainLayout;
