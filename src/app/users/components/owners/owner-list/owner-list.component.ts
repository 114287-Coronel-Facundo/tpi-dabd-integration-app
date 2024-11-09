import {
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { OwnerService } from '../../../services/owner.service';
import {
  DocumentTypeDictionary,
  Owner,
  OwnerFilters,
  OwnerTypeDictionary,
} from '../../../models/owner';
import { Router } from '@angular/router';
import { CadastreFilterButtonsComponent } from '../../commons/cadastre-filter-buttons/cadastre-filter-buttons.component';
import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ConfirmAlertComponent,
  ToastService,
  MainContainerComponent,
  TableFiltersComponent,
  Filter,
  FilterConfigBuilder,
} from 'ngx-dabd-grupo01';
import { NgbModal, NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { OwnerDetailComponent } from '../owner-detail/owner-detail.component';
import { CadastreExcelService } from '../../../services/cadastre-excel.service';
import { BehaviorSubject, Subject } from 'rxjs';
import { InfoComponent } from '../../commons/info/info.component';

@Component({
  selector: 'app-owner-list',
  standalone: true,
  imports: [
    CommonModule,
    CadastreFilterButtonsComponent,
    FormsModule,
    MainContainerComponent,
    NgbPagination,
    ConfirmAlertComponent,
    OwnerDetailComponent,
    TableFiltersComponent,
    AsyncPipe,
  ],
  templateUrl: './owner-list.component.html',
  styleUrl: './owner-list.component.css',
  providers: [DatePipe],
})
export class OwnerListComponent implements OnInit {
  constructor() {}

  //#region Services
  private router = inject(Router);
  protected ownerService = inject(OwnerService);
  private toastService = inject(ToastService);
  private modalService = inject(NgbModal);
  private excelService = inject(CadastreExcelService);
  //#end region

  //#region Variables
  currentPage: number = 0;
  pageSize: number = 10;
  sizeOptions: number[] = [10, 25, 50];
  lastPage: boolean | undefined;
  totalItems: number = 0;
  formPath: string = 'users/owner/form';
  ownerId: number | undefined;
  objectName: string = '';
  dictionaries: Array<{ [key: string]: any }> = [];
  LIMIT_32BITS_MAX = 2147483647;
  headers: string[] = ['Nombre', 'Apellido', 'Documento', 'Tipo propietario'];

  ownersList!: Owner[];
  private filteredOwnersList = new BehaviorSubject<Owner[]>([]);
  filter$ = this.filteredOwnersList.asObservable();
  //owners: Owner[] = [];
  //filteredOwnersList: Owner[] = [];
  //retrieveOwnersByActive: boolean | undefined = true;
  //ownerFirstName: string | undefined;
  //ownerLastName: string | undefined;
  //selectedDocType: string = '';
  //#endregion

  @ViewChild('ownersTable', { static: true })
  tableName!: ElementRef<HTMLTableElement>;

  ngOnInit(): void {
    this.getAllOwners();
    this.filteredOwnersList.subscribe(ow => console.log(ow));
    
  }

  ngAfterViewInit(): void {}

  //#region Owner Crud
  getAllOwners(isActive?: boolean) {
    this.ownerService
      .getOwners(this.currentPage - 1, this.pageSize, isActive)
      .subscribe({
        next: (response) => {
          this.ownersList = response.content;
          this.filteredOwnersList.next([...this.ownersList]);
          this.lastPage = response.last;
          this.totalItems = response.totalElements;
        },
        error: (error) => console.error('Error al obtener owners: ', error),
      });
  }

  assignOwnerToDelete(owner: Owner) {
    const modalRef = this.modalService.open(ConfirmAlertComponent);
    modalRef.componentInstance.alertTitle = 'Eliminar Propietario';
    modalRef.componentInstance.alertMessage = `Esta seguro que desea eliminar el propietario ${owner.firstName} ${owner.lastName} ?`;
    modalRef.componentInstance.alertVariant = 'delete';

    modalRef.result.then((result) => {
      if (result && owner.id) {
        this.ownerService.deleteOwner(owner.id, '1').subscribe({
          next: () => {
            this.toastService.sendSuccess(
              'Propietario eliminado correctamente.'
            );
            //this.confirmFilterOwner();
            location.reload();
          },
          error: () =>
            this.toastService.sendError('Error al eliminar propietario.'),
        });
      }
    });
  }

  editOwner(id: any) {
    this.router.navigate(['users/owner/form/', id]);
  }

  deleteOwner() {
    if (this.ownerId !== undefined) {
      this.ownerService.deleteOwner(this.ownerId, '1').subscribe((response) => {
        location.reload();
      });
    }
  }

  detailOwner(id: any) {
    this.router.navigate(['users/owner/detail/', id]);
  }

  cleanOwnerId() {
    this.ownerId = undefined;
  }
  //#end region

  //#region Filters
  applyFilterWithNumber: boolean = false;
  applyFilterWithCombo: boolean = false;
  contentForFilterCombo: string[] = [];
  actualFilter: string | undefined = OwnerFilters.NOTHING;
  filterTypes = OwnerFilters;
  filterInput: string = '';

  documentTypeDictionary = DocumentTypeDictionary;
  ownerTypeDictionary = OwnerTypeDictionary;
  ownerDicitionaries = [this.documentTypeDictionary, this.ownerTypeDictionary];
  protected readonly OwnerFilters = OwnerFilters;

  filterConfig: Filter[] = new FilterConfigBuilder()
    .selectFilter(
      'Tipo de Documento',
      'doc_type',
      'Seleccione un tipo de documento',
      [
        { value: 'DNI', label: 'DNI' },
        { value: 'ID', label: 'Cédula' },
        { value: 'PASSPORT', label: 'Pasaporte' },
      ]
    )
    .selectFilter(
      'Tipo de Propietario',
      'owner_type',
      'Seleccione un tipo de propietario',
      [
        { value: 'PERSON', label: 'Persona' },
        { value: 'COMPANY', label: 'Compañía' },
        { value: 'OTHER', label: 'Otro' },
      ]
    )
    .selectFilter(
      'Estado del Propietario',
      'owner_kyc',
      'Seleccione un estado del propietario',
      [
        { value: 'INITIATED', label: 'Iniciado' },
        { value: 'TO_VALIDATE', label: 'Para Validar' },
        { value: 'VALIDATED', label: 'Validado' },
        { value: 'CANCELED', label: 'Cancelado' },
      ]
    )
    .selectFilter('Activo', 'is_active', '', [
      { value: 'true', label: 'Activo' },
      { value: 'false', label: 'Inactivo' },
    ])
    .build();

  filterChange($event: Record<string, any>) {
    this.ownerService.dinamicFilters(0, this.pageSize, $event).subscribe({
      next: (result) => {
        this.ownersList = result.content;
        this.filteredOwnersList.next([...result.content]);
        this.lastPage = result.last;
        this.totalItems = result.totalElements;
      },
    });
  }

  /**
   * Filters the list of owners based on the input value in the text box.
   * The filter checks if any property of the owner contains the search string (case-insensitive).
   * The filtered list is then emitted through the `filterSubject`.
   *
   * @param event - The input event from the text box.
   */
  onFilterTextBoxChanged(event: Event) {
    const target = event.target as HTMLInputElement;
    const filterValue = target.value.toLowerCase();

    //console.log("FILTRO->", filterValue);
    console.log("DICCIONARIO->", this.ownerDicitionaries);
    //console.log("OWNERS->", this.owners);

    let filteredList = this.ownersList.filter((owner) => {
      return Object.values(owner).some((prop) => {
        const propString = prop
          ? prop
              .toString()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f.]/g, '')
          : '';

        // Validar que dictionaries esté definido y tenga elementos antes de mapear
        const translations = this.ownerDicitionaries && this.ownerDicitionaries.length
          ? this.ownerDicitionaries.map(dict => this.translateDictionary(propString, dict)).filter(Boolean)
          : [];

        // Se puede usar `includes` para verificar si hay coincidencias
        return propString.includes(filterValue); //|| translations.some(trans => trans?.toLowerCase().includes(filterValue));
      });
    });

    //console.log("LISTA FILTRADA->", filteredList);

    this.filteredOwnersList.next(filteredList);
  }

  //#end region

  //#region Dictionaries
  getKeys(dictionary: any) {
    return Object.keys(dictionary);
  }

  translateCombo(value: any, dictionary: any) {
    if (value !== undefined && value !== null) {
      return dictionary[value];
    }
    return;
  }

  translateTable(value: any, dictionary: { [key: string]: any }) {
    if (value !== undefined && value !== null) {
      for (const key in dictionary) {
        if (dictionary[key] === value) {
          return key;
        }
      }
    }
    return;
  }

  dataMapper(item: Owner) {
    return [
      item['firstName'] + (item['secondName'] ? ' ' + item['secondName'] : ''),
      item['lastName'],
      this.translateDictionary(item['documentType'], this.dictionaries[0]) +
        ': ' +
        item['documentNumber'],
      this.translateDictionary(item['ownerType'], this.dictionaries[1]),
    ];
  }
  /**
   * Translates a value using the provided dictionary.
   *
   * @param value - The value to translate.
   * @param dictionary - The dictionary used for translation.
   * @returns The key that matches the value in the dictionary, or undefined if no match is found.
   */
  translateDictionary(value: any, dictionary?: { [key: string]: any }) {
    if (value !== undefined && value !== null && dictionary) {
      for (const key in dictionary) {
        if (dictionary[key].toString().toLowerCase() === value.toLowerCase()) {
          return key;
        }
      }
    }
    return;
  }
  //#endregion

  //#region Routing
  /**
   * Redirects to the specified form path.
   */
  redirectToForm() {
    this.router.navigate([this.formPath]);
  }

  ownerPlot(ownerId: any) {
    this.router.navigate(['users/plots/owner/' + ownerId]);
  }
  //#endregion

  //#region Export
  // Se va a usar para los nombres de los archivos.
  getActualDayFormat() {
    const today = new Date();

    const formattedDate = today.toISOString().split('T')[0];

    return formattedDate;
  }

  exportToPdf() {
    this.ownerService.getOwners(0, this.LIMIT_32BITS_MAX, true).subscribe({
      next: (data) => {
        this.excelService.exportListToPdf(
          data.content,
          `${this.getActualDayFormat()}_${this.objectName}`,
          this.headers,
          this.dataMapper
        );
      },
      error: (error) => {
        console.log(error);
      },
    });
  }

  exportToExcel() {
    this.ownerService.getOwners(0, this.LIMIT_32BITS_MAX, true).subscribe({
      next: (data) => {
        this.excelService.exportListToExcel(
          data.content,
          `${this.getActualDayFormat()}_${this.objectName}`
        );
      },
      error: (error) => {
        console.log(error);
      },
    });
  }
  //#end region

  //#region Pageable
  onItemsPerPageChange() {
    this.currentPage = 1;
    //this.confirmFilterOwner();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    //this.confirmFilterOwner();
  }
  //#end region

  //#region Info Button
  openInfo() {
    const modalRef = this.modalService.open(InfoComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      centered: true,
      scrollable: true,
    });

    modalRef.componentInstance.title = 'Lista de Propietarios';
    modalRef.componentInstance.description =
      'En esta pantalla se visualizan todos los propietarios que han sido validados en el consorcio.';
    modalRef.componentInstance.body = [
      {
        title: 'Datos',
        content: [
          {
            strong: 'Nombre:',
            detail: 'Nombre completo del propietario.',
          },
          {
            strong: 'Apellido:',
            detail: 'Apellido del propietario.',
          },
          {
            strong: 'Tipo documento: ',
            detail: 'Tipo de documento del propietario.',
          },
          {
            strong: 'N° documento: ',
            detail: 'Número del documento del propietario.',
          },
          {
            strong: 'Tipo propietario: ',
            detail: 'Clasificación del propietario.',
          },
        ],
      },
      {
        title: 'Acciones',
        content: [
          {
            strong: 'Detalles: ',
            detail:
              'Redirige hacia la pantalla para poder visualizar detalladamente todos los datos del propietario.',
          },
          {
            strong: 'Ver lotes: ',
            detail:
              'Redirige hacia la pantalla para poder visualizar que lotes tiene asignado el propietario.',
          },
          {
            strong: 'Editar: ',
            detail:
              'Redirige hacia la pantalla para poder editar los datos del propietario',
          },
          {
            strong: 'Eliminar: ',
            detail: 'Inactiva el propietario.',
          },
        ],
      },
      {
        title: 'Filtros',
        content: [],
      },
      {
        title: 'Funcionalidades de los botones',
        content: [
          {
            strong: 'Filtros: ',
            detail:
              'Botón con forma de tolva que despliega los filtros avanzados.',
          },
          {
            strong: 'Añadir nuevo propietario: ',
            detail:
              'Botón "+" que redirige hacia la pantalla para dar de alta un nuevo propietario.',
          },
          {
            strong: 'Exportar a Excel: ',
            detail: 'Botón verde que exporta la grilla a un archivo de Excel.',
          },
          {
            strong: 'Exportar a PDF: ',
            detail: 'Botón rojo que exporta la grilla a un archivo de PDF.',
          },
          {
            strong: 'Paginación: ',
            detail: 'Botones para pasar de página en la grilla.',
          },
        ],
      },
    ];
    modalRef.componentInstance.notes = [
      'La interfaz está diseñada para ofrecer una administración eficiente, manteniendo la integridad y seguridad de los datos de los propietarios.',
    ];
  }
  //#end region

  //#region  Old Filters
  /* filterOwnerByDocType(docType: string, isActive?: boolean) {
    this.ownerService
      .filterOwnerByDocType(this.currentPage, this.pageSize, docType, isActive)
      .subscribe({
        next: (response) => {
          console.log('Respuesta', response);

          this.owners = response.content;
          this.filteredOwnersList = [...this.owners];
          this.lastPage = response.last;
          this.totalItems = response.totalElements;
        },
        error: (error) => console.error('Error getting owners:', error),
      });
  }

  filterOwnerByOwnerType(ownerType: string, isActive?: boolean) {
    this.ownerService
      .filterOwnerByOwnerType(
        this.currentPage,
        this.pageSize,
        ownerType,
        isActive
      )
      .subscribe({
        next: (response) => {
          this.owners = response.content;
          this.filteredOwnersList = [...this.owners];
          this.lastPage = response.last;
          this.totalItems = response.totalElements;
        },
        error: (error) => console.error('Error getting owners:', error),
      });
  }

  changeActiveFilter(isActive?: boolean) {
    this.retrieveOwnersByActive = isActive;
    this.confirmFilterOwner();
  }

  changeFilterMode(mode: OwnerFilters) {
    switch (mode) {
      case OwnerFilters.NOTHING:
        this.actualFilter = OwnerFilters.NOTHING;
        this.applyFilterWithNumber = false;
        this.applyFilterWithCombo = false;
        this.confirmFilterOwner();
        break;

      case OwnerFilters.DOC_TYPE:
        this.actualFilter = OwnerFilters.DOC_TYPE;
        this.contentForFilterCombo = this.getKeys(this.documentTypeDictionary);
        this.applyFilterWithNumber = false;
        this.applyFilterWithCombo = true;
        break;

      case OwnerFilters.OWNER_TYPE:
        this.actualFilter = OwnerFilters.OWNER_TYPE;
        this.contentForFilterCombo = this.getKeys(this.ownerTypeDictionary);
        this.applyFilterWithNumber = false;
        this.applyFilterWithCombo = true;
        break;

      default:
        break;
    }
  }

  confirmFilterOwner() {
    switch (this.actualFilter) {
      case 'NOTHING':
        this.getAllOwners(this.retrieveOwnersByActive);
        break;

      case 'DOC_TYPE':
        this.filterOwnerByDocType(
          this.translateCombo(this.filterInput, this.documentTypeDictionary),
          this.retrieveOwnersByActive
        );
        break;

      case 'OWNER_TYPE':
        this.filterOwnerByOwnerType(
          this.translateCombo(this.filterInput, this.ownerTypeDictionary),
          this.retrieveOwnersByActive
        );
        break;

      default:
        break;
    }
  }

  searchByDocType(docType: string) {
    this.filteredOwnersList = this.owners.filter(
      (owner) => owner.documentType == docType
    );
  } */
  //#end region
}
