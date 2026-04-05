import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  /** Null si el usuario solo existe vía Cognito (sin contraseña local). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ length: 120, default: 'Analyst' })
  displayName: string;

  /** Subject del token de Cognito (sub), único si está presente. */
  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  cognitoSub: string | null;
}
