import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CalendarService, DayActivitySummary } from './calendar.service';

export interface CalendarDayCell {
  date: Date;
  dateString: string; // 'YYYY-MM-DD'
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  activity?: DayActivitySummary;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss'
})
export class CalendarComponent implements OnInit {
  private calendarService = inject(CalendarService);
  private authService = inject(AuthService);

  currentDate = signal<Date>(new Date());
  calendarDays = signal<CalendarDayCell[]>([]);
  selectedDayActivity = signal<DayActivitySummary | null>(null);
  loading = signal<boolean>(true);

  protected readonly Math = Math;

  polishMonths = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];

  async ngOnInit() {
    await this.loadCalendar();
  }

  async loadCalendar() {
    const user = this.authService.currentUser();
    if (!user) return;

    this.loading.set(true);
    const year = this.currentDate().getFullYear();
    const month = this.currentDate().getMonth();

    try {
      const activitiesMap = await this.calendarService.getMonthActivities(user.id, year, month);
      this.buildCalendarGrid(year, month, activitiesMap);
    } catch (err) {
      console.error('Error loading calendar activities:', err);
    } finally {
      this.loading.set(false);
    }
  }

  buildCalendarGrid(year: number, month: number, activitiesMap: Map<string, DayActivitySummary>) {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday as first day of week (0 = Monday, 6 = Sunday)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: CalendarDayCell[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const ds = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateString: ds,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: ds === todayStr,
        activity: activitiesMap.get(ds)
      });
    }

    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const ds = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateString: ds,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: ds === todayStr,
        activity: activitiesMap.get(ds)
      });
    }

    // Next month leading days to complete grid (up to 42 cells = 6 rows)
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remainingCells = totalCells - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(year, month + 1, i);
      const ds = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateString: ds,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: ds === todayStr,
        activity: activitiesMap.get(ds)
      });
    }

    this.calendarDays.set(days);
  }

  prevMonth() {
    const d = new Date(this.currentDate());
    d.setMonth(d.getMonth() - 1);
    this.currentDate.set(d);
    this.loadCalendar();
  }

  nextMonth() {
    const d = new Date(this.currentDate());
    d.setMonth(d.getMonth() + 1);
    this.currentDate.set(d);
    this.loadCalendar();
  }

  selectDay(cell: CalendarDayCell) {
    if (cell.activity && (cell.activity.workouts.length > 0 || cell.activity.cardio.length > 0 || cell.activity.steps || cell.activity.measurements.length > 0)) {
      this.selectedDayActivity.set(cell.activity);
    }
  }

  closeDayModal() {
    this.selectedDayActivity.set(null);
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  }
}
