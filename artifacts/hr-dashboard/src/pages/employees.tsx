/**
 * @fileoverview Employees registry dashboard view.
 * Renders searchable list of employees and options to edit profiles.
 */

import { useListEmployees, useDeleteEmployee, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function EmployeesPage() {
  const { data: employees, isLoading } = useListEmployees();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-1">Directory of all team members.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Employee</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-[250px] w-full" />
            <Skeleton className="h-[250px] w-full" />
            <Skeleton className="h-[250px] w-full" />
            <Skeleton className="h-[250px] w-full" />
          </>
        ) : (
          employees?.map((employee) => (
            <Card key={employee.id} className="overflow-hidden">
              <div className="h-20 bg-muted"></div>
              <CardContent className="p-6 pt-0 relative">
                <div className="flex justify-between items-start">
                  <Avatar className="h-16 w-16 -mt-8 border-4 border-card rounded-full bg-background">
                    {employee.avatarUrl && <AvatarImage src={employee.avatarUrl} />}
                    <AvatarFallback>{employee.name.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <Button variant="ghost" size="icon" className="h-8 w-8 mt-2 -mr-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="mt-3">
                  <h3 className="font-bold text-lg leading-none">{employee.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{employee.position}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">{employee.department}</Badge>
                  <Badge variant={
                    employee.status === 'ACTIVE' ? 'default' :
                    employee.status === 'ON_LEAVE' ? 'secondary' : 'destructive'
                  }>
                    {employee.status}
                  </Badge>
                </div>

                <div className="mt-6 space-y-2 text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Mail className="mr-2 h-4 w-4" />
                    <span className="truncate">{employee.email}</span>
                  </div>
                  {employee.phone && (
                    <div className="flex items-center text-muted-foreground">
                      <Phone className="mr-2 h-4 w-4" />
                      <span className="truncate">{employee.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
