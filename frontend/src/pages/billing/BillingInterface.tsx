import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, DollarSign, Download, Send, Plus, Search, Filter, Eye, Edit, Trash2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Helmet } from "react-helmet";

interface BillingRecord {
  id: string;
  invoiceNumber: string;
  patientName: string;
  appointmentDate: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  createdAt: string;
}

const BillingInterface = () => {
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isViewInvoiceOpen, setIsViewInvoiceOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<BillingRecord | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      // Simulated data - replace with actual API call
      const mockData: BillingRecord[] = [
        {
          id: '1',
          invoiceNumber: 'INV-2024-001',
          patientName: 'María González',
          appointmentDate: '2024-01-10',
          amount: 50000,
          status: 'pending',
          dueDate: '2024-01-20',
          createdAt: '2024-01-10'
        },
        {
          id: '2',
          invoiceNumber: 'INV-2024-002',
          patientName: 'Carlos Rodríguez',
          appointmentDate: '2024-01-12',
          amount: 40000,
          status: 'paid',
          dueDate: '2024-01-22',
          createdAt: '2024-01-12'
        },
        {
          id: '3',
          invoiceNumber: 'INV-2024-003',
          patientName: 'Ana Silva',
          appointmentDate: '2024-01-08',
          amount: 50000,
          status: 'overdue',
          dueDate: '2024-01-18',
          createdAt: '2024-01-08'
        },
        {
          id: '4',
          invoiceNumber: 'INV-2024-004',
          patientName: 'Luis Martínez',
          appointmentDate: '2024-01-15',
          amount: 60000,
          status: 'pending',
          dueDate: '2024-01-25',
          createdAt: '2024-01-15'
        }
      ];

      setBillingRecords(mockData);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = billingRecords.filter(record => {
    const matchesSearch = record.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Pagado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800">Vencido</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL');
  };

  const getTotalAmount = (status?: string) => {
    const records = status ? billingRecords.filter(r => r.status === status) : billingRecords;
    return records.reduce((sum, record) => sum + record.amount, 0);
  };

  const handleCreateInvoice = () => {
    setIsCreateInvoiceOpen(true);
  };

  const handleViewInvoice = (invoice: BillingRecord) => {
    setSelectedInvoice(invoice);
    setIsViewInvoiceOpen(true);
  };

  const handleSendReminder = async (invoiceId: string) => {
    try {
      // API call to send reminder
      console.log('Sending reminder for invoice:', invoiceId);
      // Update local state to show reminder sent
    } catch (error) {
      console.error('Error sending reminder:', error);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      // API call to download invoice
      console.log('Downloading invoice:', invoiceId);
    } catch (error) {
      console.error('Error downloading invoice:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Facturación | Moca - Instagram DM Agent</title>
        <meta name="description" content="Gestiona la facturación y pagos de tu práctica médica" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Facturación</h1>
              <p className="text-gray-600">Gestiona tus facturas y pagos</p>
            </div>
            <Button onClick={handleCreateInvoice}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Factura
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(getTotalAmount())}</div>
                <p className="text-xs text-muted-foreground">
                  {billingRecords.length} facturas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendiente</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(getTotalAmount('pending'))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {billingRecords.filter(r => r.status === 'pending').length} facturas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pagado</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(getTotalAmount('paid'))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {billingRecords.filter(r => r.status === 'paid').length} facturas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vencido</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(getTotalAmount('overdue'))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {billingRecords.filter(r => r.status === 'overdue').length} facturas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Facturas</CardTitle>
                  <CardDescription>
                    Lista de todas las facturas generadas
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar facturas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="paid">Pagado</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Fecha Cita</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.invoiceNumber}</TableCell>
                      <TableCell>{record.patientName}</TableCell>
                      <TableCell>{formatDate(record.appointmentDate)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(record.amount)}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>{formatDate(record.dueDate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewInvoice(record)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadInvoice(record.id)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {record.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendReminder(record.id)}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateInvoiceOpen} onOpenChange={setIsCreateInvoiceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nueva Factura</DialogTitle>
            <DialogDescription>
              Genera una nueva factura para un paciente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="patient">Paciente</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient1">María González</SelectItem>
                    <SelectItem value="patient2">Carlos Rodríguez</SelectItem>
                    <SelectItem value="patient3">Ana Silva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="appointment">Cita</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cita" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment1">10:00 - María González</SelectItem>
                    <SelectItem value="appointment2">11:00 - Carlos Rodríguez</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="50000"
                  className="pl-8"
                />
              </div>
              
              <div>
                <Label htmlFor="dueDate">Fecha de vencimiento</Label>
                <Input
                  id="dueDate"
                  type="date"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Notas adicionales para la factura..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setIsCreateInvoiceOpen(false)}
              >
                Cancelar
              </Button>
              <Button>
                Crear Factura
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={isViewInvoiceOpen} onOpenChange={setIsViewInvoiceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Factura {selectedInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Detalles de la factura
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Paciente</Label>
                  <p className="text-sm">{selectedInvoice.patientName}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-500">Estado</Label>
                  <div className="mt-1">{getStatusBadge(selectedInvoice.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Monto</Label>
                  <p className="text-lg font-semibold">{formatCurrency(selectedInvoice.amount)}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-500">Vence</Label>
                  <p className="text-sm">{formatDate(selectedInvoice.dueDate)}</p>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => handleDownloadInvoice(selectedInvoice.id)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSendReminder(selectedInvoice.id)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Recordatorio
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BillingInterface;
