import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { parseDeviceLayoutFile } from '../layout-viewer/device-layout-upload';
import { DeviceLayoutService } from '../layout-viewer/device-layout.service';
import { KeyboardLayoutService } from '../layout-viewer/keyboard-layout.service';
import { ViewSettingsService } from '../layout-viewer/view-settings.service';

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialogComponent {
  readonly closed = output<void>();

  private readonly deviceLayoutService = inject(DeviceLayoutService);
  private readonly keyboardLayoutService = inject(KeyboardLayoutService);
  private readonly viewSettings = inject(ViewSettingsService);

  readonly deviceLayouts = this.deviceLayoutService.entities;
  readonly selectedDeviceLayoutId = this.deviceLayoutService.selectedId;

  readonly keyboardLayouts = this.keyboardLayoutService.entities;
  readonly selectedKeyboardLayoutId = this.keyboardLayoutService.selectedId;
  readonly keyboardLayout = this.keyboardLayoutService.selectedEntity;
  readonly keyboardLayoutSearchQuery = signal('');
  readonly filteredKeyboardLayouts = computed(() => {
    const query = this.keyboardLayoutSearchQuery().trim().toLowerCase();
    if (!query) {
      return this.keyboardLayouts;
    }
    return this.keyboardLayouts.filter((k) =>
      k.name.toLowerCase().includes(query),
    );
  });

  readonly showThumb3Switch = this.viewSettings.showThumb3Switch;
  readonly uploadError = signal<string | null>(null);

  setSelectedDeviceLayoutId(id: string): void {
    this.deviceLayoutService.setSelectedId(id);
  }

  setSelectedKeyboardLayoutId(id: string): void {
    this.keyboardLayoutService.setSelectedId(id);
  }

  resetKeyboardLayout(): void {
    this.keyboardLayoutService.reset();
  }

  toggleThumb3Switch(): void {
    this.viewSettings.toggleThumb3Switch();
  }

  close(): void {
    this.closed.emit();
  }

  async onFileSelected(event: Event): Promise<void> {
    this.uploadError.set(null);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const layout = parseDeviceLayoutFile(file.name, text);
      this.deviceLayoutService.addLayouts([layout]);
    } catch (error) {
      this.uploadError.set(
        error instanceof Error ? error.message : 'Failed to read file.',
      );
    } finally {
      input.value = '';
    }
  }
}
