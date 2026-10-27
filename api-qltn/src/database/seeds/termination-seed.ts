import { randomUUID } from 'crypto';
import type { DataSource } from 'typeorm';
import type { FileStorage } from '../../modules/attachments/file-storage';
import { Attachment } from '../../modules/attachments/entities/attachment.entity';
import { SUBJECT_TYPE } from '../../modules/audit/entities/audit-event.entity';
import { ExploitationContract } from '../../modules/exploitation/entities/exploitation-contract.entity';
import { ExploitationPackage } from '../../modules/exploitation/entities/exploitation-package.entity';
import { ExploitationReceivable } from '../../modules/exploitation/entities/exploitation-receivable.entity';
import { ExploitationTermination } from '../../modules/exploitation/entities/exploitation-termination.entity';
import { TERMINATION_FILE_PURPOSE } from '../../modules/exploitation/exploitation-files';
import type { TerminationsService } from '../../modules/exploitation/terminations.service';
import { actorOf } from './exploitation-contract-seed';
import { DEMO_PACKAGE_NAME, samplePdf } from './exploitation-seed';

interface Deps {
  dataSource: DataSource;
  storage: FileStorage;
  terminations: TerminationsService;
}

/**
 * SPEC F-S5 BR-F5-16, D1 p. 14: TL-001 on HĐ-001, handover BG-001 "Đạt", minutes uploaded, 5.000.000 still owed —
 * "Chưa thể đóng". HĐ-001 runs three monthly periods, so the demo ends it early on the last day of its first period:
 * the two later periods are cancelled and the first one's 5.000.000 is what remains. Through the services; once,
 * never in production (the caller guards it).
 */
export const ensureTerminationDemo = async (deps: Deps): Promise<number> => {
  const { dataSource } = deps;
  const pkg = await dataSource.getRepository(ExploitationPackage).findOneBy({ name: DEMO_PACKAGE_NAME });
  const contract = pkg
    ? await dataSource.getRepository(ExploitationContract).findOneBy({ packageId: pkg.id, status: 'ACTIVE' })
    : null;
  const bql = await actorOf(dataSource, 'BQL-A');
  if (!pkg || !contract || !bql) return 0;
  if (await dataSource.getRepository(ExploitationTermination).exists({ where: { contractId: contract.id } })) return 0;
  const first = await dataSource
    .getRepository(ExploitationReceivable)
    .findOneBy({ contractId: contract.id, periodNo: 1 });
  if (!first) return 0;
  const file = async (name: string): Promise<string> => {
    const key = randomUUID();
    const content = samplePdf(name);
    await deps.storage.save(key, content);
    const saved = await dataSource.getRepository(Attachment).save(
      dataSource.getRepository(Attachment).create({
        subjectType: SUBJECT_TYPE.EXPLOITATION_PACKAGE,
        subjectId: pkg.id,
        buildingId: pkg.buildingId,
        purpose: TERMINATION_FILE_PURPOSE,
        fileName: name,
        mimeType: 'application/pdf',
        sizeBytes: content.length,
        contentRef: key,
        uploadedBy: bql.id,
      }),
    );
    return saved.id;
  };
  const termination = await deps.terminations.create(bql, contract.id, {
    reason: 'EARLY_AGREED',
    note: 'DV-A đề nghị kết thúc sau kỳ đầu; hai bên thống nhất thanh lý.',
    terminationDate: first.periodEnd,
  });
  await deps.terminations.handover(bql, termination.id, {
    handedOn:
      first.periodEnd < new Date().toISOString().slice(0, 10) ? first.periodEnd : new Date().toISOString().slice(0, 10),
    result: 'PASSED',
    note: 'Khu vực sạch, đủ thiết bị.',
    attachmentId: await file('BG-001 Biên bản bàn giao.pdf'),
  });
  const current = await dataSource.getRepository(ExploitationTermination).findOneByOrFail({ id: termination.id });
  await deps.terminations.minutes(bql, termination.id, {
    version: current.version,
    attachmentId: await file(`${termination.code} Biên bản thanh lý.pdf`),
    signedOn: new Date().toISOString().slice(0, 10),
  });
  return 1;
};
