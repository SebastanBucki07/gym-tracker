import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts';
import { EChartsCoreOption } from 'echarts';
import { AuthService } from '../../core/auth/auth.service';
import { LocalMeasurementRepository } from '../../data-access/local/local-measurement.repository';
import { BodyMeasurement, MeasurementType, CANONICAL_BODY_WEIGHT_TYPE_ID } from '../../data-access/contracts/measurement.model';

export interface MeasurementViewData {
  type: MeasurementType;
  options: EChartsCoreOption;
  history: BodyMeasurement[];
}

@Component({
  selector: 'app-measurements',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './measurements.component.html',
  styleUrl: './measurements.component.scss'
})
export class MeasurementsComponent implements OnInit {
  private authService = inject(AuthService);
  private measurementRepo = new LocalMeasurementRepository();
  private fb = inject(FormBuilder);

  measurementTypes = signal<MeasurementType[]>([]);
  measurements = signal<BodyMeasurement[]>([]);
  viewData = signal<MeasurementViewData[]>([]);
  loading = signal<boolean>(true);
  isCreating = signal<boolean>(false);
  isCreatingType = signal<boolean>(false);

  measurementForm: FormGroup = this.fb.group({
    measurementTypeId: ['', Validators.required],
    value: [75, [Validators.required, Validators.min(0.1)]],
    measuredAt: [new Date().toISOString().substring(0, 10), Validators.required],
    notes: ['']
  });

  typeForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    unit: ['kg', Validators.required]
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const userId = this.authService.getCurrentUserId();

    this.loading.set(true);
    try {
      const [types, allMeasurements] = await Promise.all([
        this.measurementRepo.getTypes(userId),
        this.measurementRepo.getMeasurements(userId)
      ]);
      
      // Ensure body weight is always first
      const sortedTypes = [...types].sort((a, b) => {
        if (a.id === CANONICAL_BODY_WEIGHT_TYPE_ID) return -1;
        if (b.id === CANONICAL_BODY_WEIGHT_TYPE_ID) return 1;
        return a.name.localeCompare(b.name);
      });
      
      this.measurementTypes.set(sortedTypes);
      this.measurements.set(allMeasurements);
      this.buildViewData();
    } catch (err) {
      console.error('Error loading measurements:', err);
    } finally {
      this.loading.set(false);
    }
  }
  
  scrollToType(typeId: string) {
    const el = document.getElementById('chart-section-' + typeId);
    if (el) {
      // Offset for sticky header
      const headerOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
  
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }

  buildViewData() {
    const types = this.measurementTypes();
    const allMeas = this.measurements();
    const result: MeasurementViewData[] = [];

    for (const type of types) {
      const isWeightSelected = type.id === CANONICAL_BODY_WEIGHT_TYPE_ID;
      let filtered = allMeas.filter(m => {
        if (m.measurementTypeId === type.id) return true;
        if (isWeightSelected && (m.measurementTypeId.startsWith('type_weight_') || m.measurementTypeId === 'meas_type_weight')) {
          return true;
        }
        return false;
      });
      
      filtered = filtered.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
      
      const chartData = [...filtered].sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
      const dates = chartData.map(m => new Date(m.measuredAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }));
      const values = chartData.map(m => m.value);
      
      const options: EChartsCoreOption = {
        title: { text: `Postęp: ${type.name}`, left: 'center', textStyle: { fontSize: 16 } },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dates },
        yAxis: { type: 'value', axisLabel: { formatter: `{value} ${type.unit}` }, scale: true },
        series: [{
          data: values, type: 'line', smooth: true, lineStyle: { color: '#007bff', width: 3 },
          itemStyle: { color: '#007bff' },
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(0, 123, 255, 0.3)' }, { offset: 1, color: 'rgba(0, 123, 255, 0.0)' }]
            }
          }
        }],
        grid: { top: 50, bottom: 30, left: 50, right: 20 }
      };
      
      result.push({ type, options, history: filtered });
    }
    
    this.viewData.set(result);
  }

  openCreateModal() {
    this.measurementForm.reset({
      measurementTypeId: this.measurementTypes()[0]?.id || CANONICAL_BODY_WEIGHT_TYPE_ID,
      value: 75,
      measuredAt: new Date().toISOString().substring(0, 10),
      notes: ''
    });
    this.isCreating.set(true);
  }

  closeModal() {
    this.isCreating.set(false);
  }

  async saveMeasurement() {
    if (this.measurementForm.invalid) return;
    const userId = this.authService.getCurrentUserId();
    const val = this.measurementForm.value;
    const measurement: BodyMeasurement = {
      id: 'meas_' + crypto.randomUUID(),
      userId,
      measurementTypeId: val.measurementTypeId,
      value: Number(val.value),
      measuredAt: new Date(val.measuredAt),
      notes: val.notes || undefined
    };

    try {
      await this.measurementRepo.createMeasurement(measurement);
      this.closeModal();
      await this.loadData();
    } catch (err) {
      console.error('Error saving measurement:', err);
    }
  }

  openCreateTypeModal() {
    this.typeForm.reset({ name: '', unit: 'kg' });
    this.isCreatingType.set(true);
  }

  closeTypeModal() {
    this.isCreatingType.set(false);
  }

  async saveMeasurementType() {
    if (this.typeForm.invalid) return;
    const userId = this.authService.getCurrentUserId();
    const val = this.typeForm.value;
    const typeId = 'type_' + crypto.randomUUID();
    const newType: MeasurementType = {
      id: typeId,
      userId,
      name: val.name,
      unit: val.unit,
      isSystem: false
    };

    try {
      await this.measurementRepo.createMeasurementType(newType);
      this.closeTypeModal();
      await this.loadData();
    } catch (err) {
      console.error('Error saving measurement type:', err);
    }
  }

  async deleteMeasurement(id: string) {
    if (!confirm('Czy na pewno chcesz usunąć ten pomiar?')) return;
    try {
      await this.measurementRepo.deleteMeasurement(id);
      await this.loadData();
    } catch (err) {
      console.error('Error deleting measurement:', err);
    }
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
