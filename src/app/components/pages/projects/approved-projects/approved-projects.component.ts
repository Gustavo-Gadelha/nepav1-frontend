import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { ProjectService } from '@/services/project/project.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IProject } from '@/models/IProject';
import { LoginService } from '@//app/services/login/login.service';
import { ISubToken } from '@//app/models/ISubToken';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-approved-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './approved-projects.component.html',
  styleUrl: './approved-projects.component.css'
})
export class ApprovedProjectsComponent implements OnInit {
  private projectService = inject(ProjectService);
  private loginService = inject(LoginService);
  private toast = inject(ToastrService);
  private projects$: Observable<any[]> = new Observable<IProject[]>();

  public filteredProjects: any[] = [];
  public filter: string = "";
  public subToken: ISubToken | null = null;
  public isAdmin: boolean = false;
  public isActive: boolean = false;
  public projectSelected?: IProject;
  public studentSituationInTheProject: string = "";
  public studentInTheProject: boolean = false;

  @ViewChild('content', {static: false}) el!: ElementRef;

  ngOnInit(): void {
    this.getProjects();
    this.subToken = this.loginService.decodeToken();
    this.isAdmin = this.subToken?.role === 'Admin';
  }

  printPDF(id: string) {
    this.projectService.getProjectById(id).subscribe(project => {
      const element = this.el.nativeElement;

      html2canvas(element).then(canvas => {
        const doc = new jsPDF('p', 'pt', 'a4', true);
        const imgData = canvas.toDataURL('image/png');
        const a4Width = 595;
        const a4Height = 842;
        const imgWidth = a4Width;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= a4Height;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          doc.addPage();
          doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= a4Height;
        }

        doc.save(`${project.titulo}.pdf`);
      });
    });
  }

  printDocument(id: string) {
    this.projectService.getProjectById(id).subscribe(project => {
      const element = this.el.nativeElement;

      html2canvas(element).then(canvas => {
        const doc = new jsPDF('p', 'pt', 'a4', true);
        const imgData = canvas.toDataURL('image/png');
        const a4Width = 595;
        const a4Height = 842;
        const imgWidth = a4Width;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= a4Height;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          doc.addPage();
          doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= a4Height;
        }

        doc.autoPrint();
        window.open(URL.createObjectURL(doc.output('blob')), '_blank');
      });
    });
  }

  getProjects() {
    this.projects$ = this.projectService.getAllApprovedProjects();
    this.projects$.subscribe(projects => this.filteredProjects = projects);
  }

  toggleModal(project?: IProject) {
    this.projectSelected = project;
    this.isActive = !this.isActive;
  }

  registerInTheProject(id: string) {
    this.projectService.studentRegistrationInTheProject(id).pipe(
      tap(res => {
        this.toast.success("Inscrição realizada com sucesso!");
      }),
      catchError((error) => {
        this.toast.error("Não foi possível realizar a inscrição no projeto!");
        return of({success: false, error});
      })
    ).subscribe(() => this.getProjects());
  }

  filterProjects() {
    if (this.filter.trim() === "") {
      this.getProjects();
    } else {
      this.projects$ = this.projectService.getAllApprovedProjects().pipe(
        map((projects: IProject[]) =>
          projects.filter((project: IProject) =>
            project.titulo.toLocaleLowerCase().includes(this.filter.toLocaleLowerCase())
          )
        )
      );
      this.projects$.subscribe(projects => this.filteredProjects = projects);
    }
  }
}
