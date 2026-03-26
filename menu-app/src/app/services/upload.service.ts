import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

interface UploadResponse {
  success: boolean;
  data?: { url: string };
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly apiUrl = `${environment.apiUrl}/upload`;

  constructor(private http: HttpClient) {}

  uploadImage(file: File, folder: string = 'general'): Observable<string> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<UploadResponse>(`${this.apiUrl}/image?folder=${encodeURIComponent(folder)}`, formData).pipe(
      map(res => res.data!.url)
    );
  }
}
